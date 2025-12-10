const zlib = require('zlib');
const { promisify } = require('util');
const messageConfig = require('../config/message');
const compressionTypes = require('../constants/compressionTypes');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

/**
 * Compression Utilities
 * Handles message compression and decompression
 */

/**
 * Compress a buffer using the configured algorithm
 * @param {Buffer} plainBuffer - Plain text buffer to compress
 * @param {string} [algorithm] - Compression algorithm ('gzip' or 'brotli')
 * @returns {Promise<{compressedBuffer: Buffer, compressionType: string, uncompressedSize: number}>}
 */
async function compressBuffer(plainBuffer, algorithm = null) {
  const compressionType = algorithm || messageConfig.compressionAlgorithm;
  const uncompressedSize = plainBuffer.length;
  
  let compressedBuffer;
  
  try {
    if (compressionType === compressionTypes.GZIP) {
      compressedBuffer = await gzip(plainBuffer, { level: 6 }); // Balance between speed and size
    } else if (compressionType === compressionTypes.BROTLI) {
      compressedBuffer = await brotliCompress(plainBuffer, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 4, // Balance between speed and size
        }
      });
    } else {
      throw new Error(`Unsupported compression algorithm: ${compressionType}`);
    }
    
    return {
      compressedBuffer,
      compressionType,
      uncompressedSize
    };
  } catch (error) {
    console.error('❌ Compression error:', error);
    throw new Error(`Compression failed: ${error.message}`);
  }
}

/**
 * Decompress a buffer using the specified algorithm
 * @param {Buffer} compressedBuffer - Compressed buffer
 * @param {string} compressionType - Compression algorithm used ('gzip' or 'brotli')
 * @returns {Promise<Buffer>} Decompressed plain buffer
 */
async function decompressBuffer(compressedBuffer, compressionType) {
  try {
    if (compressionType === compressionTypes.GZIP) {
      return await gunzip(compressedBuffer);
    } else if (compressionType === compressionTypes.BROTLI) {
      return await brotliDecompress(compressedBuffer);
    } else {
      throw new Error(`Unsupported compression algorithm: ${compressionType}`);
    }
  } catch (error) {
    console.error('❌ Decompression error:', error);
    throw new Error(`Decompression failed: ${error.message}`);
  }
}

/**
 * Compress a string (converts to buffer first)
 * @param {string} plainText - Plain text string
 * @param {string} [algorithm] - Compression algorithm
 * @returns {Promise<{compressedBuffer: Buffer, compressionType: string, uncompressedSize: number}>}
 */
async function compressString(plainText, algorithm = null) {
  const buffer = Buffer.from(plainText, 'utf8');
  return await compressBuffer(buffer, algorithm);
}

/**
 * Decompress a buffer to string
 * @param {Buffer} compressedBuffer - Compressed buffer
 * @param {string} compressionType - Compression algorithm
 * @returns {Promise<string>} Decompressed plain text string
 */
async function decompressToString(compressedBuffer, compressionType) {
  const buffer = await decompressBuffer(compressedBuffer, compressionType);
  return buffer.toString('utf8');
}

module.exports = {
  compressBuffer,
  decompressBuffer,
  compressString,
  decompressToString
};
