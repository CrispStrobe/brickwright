// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors. All rights reserved.
// See the repository LICENSE for the complete license terms.

//! Staged byte UART transport, not a Renode monitor or a Tauri command.
//! Existing policy, supervisor and debugger interfaces are retained unchanged.
//! No firmware/backend provenance claim follows from this host component.
//! Native session ownership must supply a fresh generation and retain the
//! endpoint; neither a port nor a path appears in the future broker byte DTOs.
//! This module is intentionally not wired into the application yet.
//! TCP writes of at most 32 bytes do not provide simulated UART pacing: the
//! future owner must pace or instrument model input before enabling a GUI
//! client. Renode UART analyzer handshake and owned-session socket association
//! are not qualified by these synthetic localhost tests.

use std::io::{self, Read, Write};
use std::net::{Ipv4Addr, Shutdown, SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, TryLockError};
use std::thread;
use std::time::{Duration, Instant};

pub(crate) const MAX_READ_BYTES: usize = 4096;
pub(crate) const MAX_WRITE_BYTES: usize = 32;
const MAX_DEADLINE: Duration = Duration::from_secs(1);
const POLL_INTERVAL: Duration = Duration::from_millis(2);

/// Native-only port reservation. No constructor accepts caller addresses.
pub(crate) struct UartEndpointReservation(TcpListener);
pub(crate) struct NativeUartEndpoint(SocketAddr);

impl UartEndpointReservation {
    pub(crate) fn reserve() -> Result<Self, UartError> {
        TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
            .map(Self)
            .map_err(|_| UartError::Unavailable)
    }

    /// Call only in the supervisor immediately before launching its fixed UART
    /// analyzer listener. Releasing a reserved port cannot authenticate the next
    /// listener: integration still needs owned-process readiness/identity and
    /// must fail closed on bind failure, never attach to an unrelated service.
    /// The endpoint token is native-only and intentionally not serializable.
    pub(crate) fn release_for_analyzer(self) -> Result<NativeUartEndpoint, UartError> {
        let endpoint = self.0.local_addr().map_err(|_| UartError::Unavailable)?;
        if !endpoint.ip().is_loopback() || endpoint.port() == 0 {
            return Err(UartError::Unavailable);
        }
        Ok(NativeUartEndpoint(endpoint))
    }
}

impl NativeUartEndpoint {
    /// Only the native supervisor may use this in its fixed analyzer setup.
    pub(crate) fn analyzer_port(&self) -> u16 {
        self.0.port()
    }
}

/// Closed native DTO contract; the eventual broker must strictly decode these
/// fields, reject extras and oversized byte arrays before allocating them, and
/// correlate its own request IDs. Generation is correlation, not authorization.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum UartRequest {
    Read {
        generation: u64,
        max_bytes: usize,
        deadline_ms: u32,
    },
    Write {
        generation: u64,
        bytes: Vec<u8>,
    },
    Close {
        generation: u64,
    },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum UartReply {
    Bytes { generation: u64, bytes: Vec<u8> },
    Written { generation: u64, count: usize },
    Eof { generation: u64 },
    Closed { generation: u64 },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum UartError {
    Bounds,
    WrongGeneration,
    Busy,
    Timeout,
    Cancelled,
    Unavailable,
}

// A one-shot test rendezvous observes a real pending read without acquiring its
// ownership mutex. Both the observer and its wait are absent from release builds.
#[cfg(test)]
struct PendingReadFixture {
    ready: std::sync::mpsc::Sender<()>,
    resume: std::sync::mpsc::Receiver<()>,
}

struct Inner {
    generation: u64,
    stream: TcpStream,
    stopped: AtomicBool,
    reader: Mutex<()>,
    writer: Mutex<()>,
    #[cfg(test)]
    pending_read_fixture: Mutex<Option<PendingReadFixture>>,
}

/// All clones share exactly one owned connection; no global session lock is
/// held during I/O. A competing read or write fails immediately with Busy.
#[derive(Clone)]
pub(crate) struct SpikeMicroPythonUart(Arc<Inner>);

impl SpikeMicroPythonUart {
    pub(crate) fn connect(
        endpoint: NativeUartEndpoint,
        generation: u64,
    ) -> Result<Self, UartError> {
        if generation == 0 || !endpoint.0.ip().is_loopback() || endpoint.0.port() == 0 {
            return Err(UartError::Bounds);
        }
        let stream = TcpStream::connect_timeout(&endpoint.0, MAX_DEADLINE)
            .map_err(|_| UartError::Unavailable)?;
        stream
            .set_nonblocking(true)
            .map_err(|_| UartError::Unavailable)?;
        stream
            .set_nodelay(true)
            .map_err(|_| UartError::Unavailable)?;
        Ok(Self(Arc::new(Inner {
            generation,
            stream,
            stopped: AtomicBool::new(false),
            reader: Mutex::new(()),
            writer: Mutex::new(()),
            #[cfg(test)]
            pending_read_fixture: Mutex::new(None),
        })))
    }

    pub(crate) fn invoke(&self, request: UartRequest) -> Result<UartReply, UartError> {
        match request {
            UartRequest::Read {
                generation,
                max_bytes,
                deadline_ms,
            } => {
                self.check_generation(generation)?;
                if max_bytes == 0
                    || max_bytes > MAX_READ_BYTES
                    || deadline_ms == 0
                    || deadline_ms > 1000
                {
                    return Err(UartError::Bounds);
                }
                let _exclusive = exclusive(&self.0.reader)?;
                let deadline = Instant::now() + Duration::from_millis(deadline_ms.into());
                let mut bytes = vec![0; max_bytes];
                loop {
                    self.check_live(deadline)?;
                    match (&self.0.stream).read(&mut bytes) {
                        Ok(_) if self.0.stopped.load(Ordering::Acquire) => {
                            return Err(UartError::Cancelled)
                        }
                        Ok(0) => return Ok(UartReply::Eof { generation }),
                        Ok(count) => {
                            bytes.truncate(count);
                            return Ok(UartReply::Bytes { generation, bytes });
                        }
                        Err(error) if retryable(&error) => {
                            #[cfg(test)]
                            {
                                let fixture = self.0.pending_read_fixture.lock().unwrap().take();
                                if let Some(fixture) = fixture {
                                    fixture.ready.send(()).unwrap();
                                    fixture.resume.recv().unwrap();
                                }
                            }
                            pause(deadline);
                        }
                        Err(_) => return Err(self.io_error()),
                    }
                }
            }
            UartRequest::Write { generation, bytes } => {
                self.check_generation(generation)?;
                if bytes.is_empty() || bytes.len() > MAX_WRITE_BYTES {
                    return Err(UartError::Bounds);
                }
                let _exclusive = exclusive(&self.0.writer)?;
                let deadline = Instant::now() + MAX_DEADLINE;
                let mut written = 0;
                let result = (|| {
                    while written < bytes.len() {
                        self.check_live(deadline)?;
                        match (&self.0.stream).write(&bytes[written..]) {
                            Ok(0) => return Err(UartError::Unavailable),
                            Ok(count) => written += count,
                            Err(error) if retryable(&error) => pause(deadline),
                            Err(_) => return Err(self.io_error()),
                        }
                    }
                    self.check_live(deadline)?;
                    Ok(UartReply::Written {
                        generation,
                        count: written,
                    })
                })();
                // A failed partial write has no safely retryable byte boundary.
                if result.is_err() && written != 0 {
                    self.cancel();
                }
                result
            }
            UartRequest::Close { generation } => {
                self.check_generation(generation)?;
                self.cancel();
                Ok(UartReply::Closed { generation })
            }
        }
    }

    /// Teardown is independent of reader/writer locks and wakes pending I/O.
    /// Only this connection is shut down; no process or other socket is closed.
    pub(crate) fn cancel(&self) {
        self.0.stopped.store(true, Ordering::Release);
        let _ = self.0.stream.shutdown(Shutdown::Both);
    }

    fn check_generation(&self, generation: u64) -> Result<(), UartError> {
        if generation != self.0.generation {
            Err(UartError::WrongGeneration)
        } else {
            Ok(())
        }
    }
    fn check_live(&self, deadline: Instant) -> Result<(), UartError> {
        if self.0.stopped.load(Ordering::Acquire) {
            Err(UartError::Cancelled)
        } else if Instant::now() >= deadline {
            Err(UartError::Timeout)
        } else {
            Ok(())
        }
    }
    fn io_error(&self) -> UartError {
        if self.0.stopped.load(Ordering::Acquire) {
            UartError::Cancelled
        } else {
            UartError::Unavailable
        }
    }
}

impl Drop for Inner {
    fn drop(&mut self) {
        let _ = self.stream.shutdown(Shutdown::Both);
    }
}

fn exclusive(lock: &Mutex<()>) -> Result<MutexGuard<'_, ()>, UartError> {
    lock.try_lock().map_err(|error| match error {
        TryLockError::WouldBlock => UartError::Busy,
        TryLockError::Poisoned(_) => UartError::Unavailable,
    })
}
fn retryable(error: &io::Error) -> bool {
    matches!(
        error.kind(),
        io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
    )
}
fn pause(deadline: Instant) {
    thread::sleep(POLL_INTERVAL.min(deadline.saturating_duration_since(Instant::now())));
}

#[cfg(test)]
mod tests {
    use super::*;

    const GENERATION: u64 = 41;

    fn pair() -> (SpikeMicroPythonUart, TcpStream) {
        let reservation = UartEndpointReservation::reserve().unwrap();
        let endpoint = reservation.release_for_analyzer().unwrap();
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, endpoint.analyzer_port())).unwrap();
        let transport = SpikeMicroPythonUart::connect(endpoint, GENERATION).unwrap();
        let (peer, address) = listener.accept().unwrap();
        assert!(address.ip().is_loopback());
        peer.set_read_timeout(Some(MAX_DEADLINE)).unwrap();
        peer.set_write_timeout(Some(MAX_DEADLINE)).unwrap();
        (transport, peer)
    }

    fn read(max_bytes: usize, deadline_ms: u32) -> UartRequest {
        UartRequest::Read {
            generation: GENERATION,
            max_bytes,
            deadline_ms,
        }
    }

    fn bytes(reply: UartReply) -> Vec<u8> {
        match reply {
            UartReply::Bytes { generation, bytes } => {
                assert_eq!(generation, GENERATION);
                bytes
            }
            other => panic!("expected bytes, got {other:?}"),
        }
    }

    #[test]
    fn synthetic_fragmentation_preserves_raw_bytes_without_protocol_framing() {
        let (uart, mut peer) = pair();
        let fragments: &[&[u8]] = &[b"\0\xff", b"\r", b"\n>>> "];
        let mut received = Vec::new();
        for fragment in fragments {
            peer.write_all(fragment).unwrap();
            let mut count = 0;
            while count < fragment.len() {
                let part = bytes(uart.invoke(read(2, 1000)).unwrap());
                assert!(part.len() <= 2);
                count += part.len();
                received.extend(part);
            }
        }
        assert_eq!(received, b"\0\xff\r\n>>> ");
    }

    #[test]
    fn synthetic_read_ceiling_does_not_drop_remaining_bytes() {
        let (uart, mut peer) = pair();
        let payload: Vec<u8> = (0..5000).map(|index| index as u8).collect();
        peer.write_all(&payload).unwrap();
        let mut received = Vec::new();
        while received.len() < payload.len() {
            let part = bytes(uart.invoke(read(MAX_READ_BYTES, 1000)).unwrap());
            assert!(part.len() <= MAX_READ_BYTES);
            received.extend(part);
        }
        assert_eq!(received, payload);
    }

    #[test]
    fn synthetic_write_limits_reject_before_sending_and_allow_binary() {
        let (uart, mut peer) = pair();
        for bytes in [vec![], vec![0xff; MAX_WRITE_BYTES + 1]] {
            assert_eq!(
                uart.invoke(UartRequest::Write {
                    generation: GENERATION,
                    bytes
                }),
                Err(UartError::Bounds)
            );
        }
        let payload = vec![0xff; MAX_WRITE_BYTES];
        assert_eq!(
            uart.invoke(UartRequest::Write {
                generation: GENERATION,
                bytes: payload.clone()
            }),
            Ok(UartReply::Written {
                generation: GENERATION,
                count: MAX_WRITE_BYTES
            })
        );
        let mut received = [0u8; MAX_WRITE_BYTES];
        peer.read_exact(&mut received).unwrap();
        assert_eq!(received.as_slice(), payload);
        peer.set_read_timeout(Some(Duration::from_millis(30)))
            .unwrap();
        assert!(
            matches!(peer.read(&mut [0]), Err(error) if matches!(error.kind(), io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut))
        );
    }

    #[test]
    fn synthetic_wrong_generation_cannot_read_write_or_close_own_connection() {
        let (uart, mut peer) = pair();
        for request in [
            UartRequest::Read {
                generation: GENERATION + 1,
                max_bytes: 1,
                deadline_ms: 1,
            },
            UartRequest::Write {
                generation: GENERATION + 1,
                bytes: vec![7],
            },
            UartRequest::Close {
                generation: GENERATION + 1,
            },
        ] {
            assert_eq!(uart.invoke(request), Err(UartError::WrongGeneration));
        }
        peer.write_all(&[99]).unwrap();
        assert_eq!(bytes(uart.invoke(read(1, 1000)).unwrap()), [99]);
    }

    #[test]
    fn synthetic_eof_is_distinct_from_timeout_and_cancel() {
        let (uart, peer) = pair();
        peer.shutdown(Shutdown::Write).unwrap();
        assert_eq!(
            uart.invoke(read(1, 1000)),
            Ok(UartReply::Eof {
                generation: GENERATION
            })
        );
    }

    #[test]
    fn synthetic_read_bounds_and_absolute_deadline() {
        let (uart, _peer) = pair();
        for request in [
            read(0, 100),
            read(MAX_READ_BYTES + 1, 100),
            read(1, 0),
            read(1, 1001),
        ] {
            assert_eq!(uart.invoke(request), Err(UartError::Bounds));
        }
        let start = Instant::now();
        assert_eq!(uart.invoke(read(1, 50)), Err(UartError::Timeout));
        assert!(start.elapsed() >= Duration::from_millis(50));
        assert!(start.elapsed() < Duration::from_millis(500));
        // A timeout releases reader ownership and keeps the connection usable.
        assert_eq!(uart.invoke(read(1, 10)), Err(UartError::Timeout));
    }

    #[test]
    fn synthetic_close_cancels_pending_read_and_only_its_own_socket() {
        let (uart, mut peer) = pair();
        let (other, mut other_peer) = pair();
        let (ready, pending_read) = std::sync::mpsc::channel();
        let (resume, resume_read) = std::sync::mpsc::channel();
        *uart.0.pending_read_fixture.lock().unwrap() = Some(PendingReadFixture {
            ready,
            resume: resume_read,
        });
        let pending = uart.clone();
        let reader = thread::spawn(move || pending.invoke(read(1, 1000)));
        // The worker signals only after its real read is pending while it owns
        // the reader mutex. The observer never competes for that mutex, and the
        // rendezvous retains ownership until the test has issued Close.
        pending_read
            .recv_timeout(Duration::from_secs(5))
            .expect("reader never reached pending I/O");
        let start = Instant::now();
        assert_eq!(uart.invoke(read(1, 1000)), Err(UartError::Busy));
        assert_eq!(
            uart.invoke(UartRequest::Close {
                generation: GENERATION
            }),
            Ok(UartReply::Closed {
                generation: GENERATION
            })
        );
        resume.send(()).unwrap();
        assert_eq!(reader.join().unwrap(), Err(UartError::Cancelled));
        assert!(start.elapsed() < Duration::from_millis(300));
        assert_eq!(uart.invoke(read(1, 1000)), Err(UartError::Cancelled));
        assert_eq!(
            uart.invoke(UartRequest::Close {
                generation: GENERATION
            }),
            Ok(UartReply::Closed {
                generation: GENERATION
            })
        );
        assert_eq!(peer.read(&mut [0]).unwrap(), 0);
        other_peer.write_all(&[13]).unwrap();
        assert_eq!(bytes(other.invoke(read(1, 1000)).unwrap()), [13]);
    }
}
