//! UTF-8 validation benchmarks for rsws.
//!
//! Run with: `cargo bench --bench utf8`

use criterion::{Criterion, Throughput, black_box, criterion_group, criterion_main};
use rsws::protocol::utf8::validate_utf8;

fn bench_utf8_validation(c: &mut Criterion) {
    let mut group = c.benchmark_group("utf8_validation");

    let sizes = [64, 1024, 65536, 1024 * 1024];
    let size_names = ["64b", "1kb", "64kb", "1mb"];

    for (size, name) in sizes.iter().zip(size_names.iter()) {
        group.throughput(Throughput::Bytes(*size as u64));

        // Case 1: ASCII-only data
        let ascii_data = vec![b'a'; *size];
        group.bench_function(format!("ascii_{}", name), |b| {
            b.iter(|| validate_utf8(black_box(&ascii_data)))
        });

        // Case 2: Mixed multi-byte UTF-8 data (Japanese, emojis, etc.)
        let mixed_pattern = "Hello 世界 🌍 ".as_bytes(); // 16 bytes
        let mut mixed_data = Vec::with_capacity(*size);
        while mixed_data.len() + mixed_pattern.len() <= *size {
            mixed_data.extend_from_slice(mixed_pattern);
        }
        // Fill remaining with ASCII if necessary
        let remaining = *size - mixed_data.len();
        if remaining > 0 {
            mixed_data.extend_from_slice(&vec![b'!'; remaining]);
        }

        group.bench_function(format!("mixed_{}", name), |b| {
            b.iter(|| validate_utf8(black_box(&mixed_data)))
        });
    }

    group.finish();
}

criterion_group!(benches, bench_utf8_validation);
criterion_main!(benches);
