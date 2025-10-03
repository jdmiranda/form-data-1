#!/usr/bin/env node
'use strict';

var FormData = require('./lib/form_data');
var fs = require('fs');
var path = require('path');

// Benchmark utilities
function benchmark(name, fn, iterations) {
  var start = process.hrtime.bigint();

  for (var i = 0; i < iterations; i++) {
    fn();
  }

  var end = process.hrtime.bigint();
  var duration = Number(end - start) / 1000000; // Convert to ms
  var opsPerSec = (iterations / duration) * 1000;

  console.log(name + ':');
  console.log('  Total time: ' + duration.toFixed(2) + ' ms');
  console.log('  Operations: ' + iterations);
  console.log('  Ops/sec: ' + opsPerSec.toFixed(0));
  console.log('  Avg time per op: ' + (duration / iterations).toFixed(3) + ' ms');
  console.log('');

  return opsPerSec;
}

// Create test files
var smallFile = path.join(__dirname, 'test', 'tmp', 'benchmark-small.txt');
var largeFile = path.join(__dirname, 'test', 'tmp', 'benchmark-large.txt');

// Ensure test/tmp directory exists
try {
  fs.mkdirSync(path.join(__dirname, 'test', 'tmp'), { recursive: true });
} catch (e) {
  // Directory already exists
}

// Create small test file (1KB)
fs.writeFileSync(smallFile, Buffer.alloc(1024, 'a'));

// Create large test file (1MB)
fs.writeFileSync(largeFile, Buffer.alloc(1024 * 1024, 'b'));

console.log('=== FormData Performance Benchmarks ===\n');

// Benchmark 1: Form creation
console.log('--- Form Creation ---');
benchmark('Create empty forms', function() {
  var form = new FormData();
}, 10000);

// Benchmark 2: Append simple string fields
console.log('--- Append String Fields ---');
benchmark('Append 10 string fields', function() {
  var form = new FormData();
  for (var i = 0; i < 10; i++) {
    form.append('field' + i, 'value' + i);
  }
}, 5000);

// Benchmark 3: Append with same field name (cache test)
console.log('--- Append Repeated Fields (Cache Test) ---');
benchmark('Append same field 100 times', function() {
  var form = new FormData();
  for (var i = 0; i < 100; i++) {
    form.append('repeated', 'value' + i);
  }
}, 1000);

// Benchmark 4: Append buffer fields
console.log('--- Append Buffer Fields ---');
var testBuffer = Buffer.alloc(1024, 'x');
benchmark('Append 10 buffer fields (1KB each)', function() {
  var form = new FormData();
  for (var i = 0; i < 10; i++) {
    form.append('buffer' + i, testBuffer);
  }
}, 3000);

// Benchmark 5: File append operations (small files)
console.log('--- Append Small Files ---');
benchmark('Append 5 small files (1KB each)', function() {
  var form = new FormData();
  for (var i = 0; i < 5; i++) {
    form.append('file' + i, fs.createReadStream(smallFile));
  }
}, 2000);

// Benchmark 6: File append operations (large files)
console.log('--- Append Large Files ---');
benchmark('Append 2 large files (1MB each)', function() {
  var form = new FormData();
  for (var i = 0; i < 2; i++) {
    form.append('bigfile' + i, fs.createReadStream(largeFile));
  }
}, 500);

// Benchmark 7: GetBuffer serialization (small)
console.log('--- Serialization (Small Form) ---');
var smallForm = new FormData();
for (var i = 0; i < 5; i++) {
  smallForm.append('field' + i, 'value' + i);
}
smallForm.append('buffer', Buffer.alloc(512, 'y'));

var bufferTime = benchmark('Serialize small form to buffer', function() {
  smallForm.getBuffer();
}, 5000);

// Calculate throughput
var smallFormSize = smallForm.getBuffer().length;
var throughput = (smallFormSize * 5000) / 1024 / 1024; // MB
console.log('  Throughput: ' + throughput.toFixed(2) + ' MB total');
console.log('');

// Benchmark 8: GetBuffer serialization (medium)
console.log('--- Serialization (Medium Form) ---');
var mediumForm = new FormData();
for (var i = 0; i < 20; i++) {
  mediumForm.append('field' + i, 'value' + i);
}
mediumForm.append('buffer', Buffer.alloc(10240, 'z'));

benchmark('Serialize medium form to buffer', function() {
  mediumForm.getBuffer();
}, 2000);

var mediumFormSize = mediumForm.getBuffer().length;
console.log('  Form size: ' + (mediumFormSize / 1024).toFixed(2) + ' KB');
console.log('');

// Benchmark 9: Boundary generation
console.log('--- Boundary Generation (Pool Test) ---');
benchmark('Generate 1000 boundaries', function() {
  var form = new FormData();
  form.getBoundary();
}, 1000);

// Benchmark 10: GetHeaders
console.log('--- Get Headers ---');
var headerForm = new FormData();
headerForm.append('field', 'value');
benchmark('Get headers', function() {
  headerForm.getHeaders();
}, 10000);

// Benchmark 11: Mixed content form (without streams for getBuffer)
console.log('--- Mixed Content Form ---');
benchmark('Create mixed form (strings, buffers)', function() {
  var form = new FormData();
  form.append('name', 'test');
  form.append('email', 'test@example.com');
  form.append('buffer', Buffer.alloc(256, 'a'));
  form.append('data', 'some data value');
  form.getBuffer();
}, 1000);

// Benchmark 12: MIME type lookup (cache test)
console.log('--- MIME Type Lookup (Cache Test) ---');
benchmark('Append buffers with filenames (cache test)', function() {
  var form = new FormData();
  var testBuf = Buffer.alloc(100, 'test');
  for (var i = 0; i < 20; i++) {
    form.append('file' + i, testBuf, {
      filename: 'test' + i + '.txt'
    });
  }
}, 1000);

// Cleanup
fs.unlinkSync(smallFile);
fs.unlinkSync(largeFile);

console.log('=== Benchmarks Complete ===');
console.log('\nOptimizations applied:');
console.log('  - Boundary generation pool (50 pre-generated boundaries)');
console.log('  - MIME type lookup cache (LRU, max 100 entries)');
console.log('  - Header building cache (LRU, max 500 entries)');
console.log('  - Buffer concatenation optimization (single concat with pre-calculated size)');
