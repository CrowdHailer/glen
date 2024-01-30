// Taken from https://github.com/remix-run/remix/blob/main/packages/remix-node/stream.ts

import { Stream } from 'node:stream';

export const createReadableStreamFromReadable = (source) => {
  let pump = new StreamPump(source);
  let stream = new ReadableStream(pump, pump);
  return stream;
};

class StreamPump {
  constructor(stream) {
    this.highWaterMark =
      stream.readableHighWaterMark ||
      new Stream.Readable().readableHighWaterMark;
    this.accumalatedSize = 0;
    this.stream = stream;
    this.enqueue = this.enqueue.bind(this);
    this.error = this.error.bind(this);
    this.close = this.close.bind(this);
  }

  size(chunk) {
    return chunk?.byteLength || 0;
  }

  start(controller) {
    this.controller = controller;
    this.stream.on('data', this.enqueue);
    this.stream.once('error', this.error);
    this.stream.once('end', this.close);
    this.stream.once('close', this.close);
  }

  pull() {
    this.resume();
  }

  cancel(reason) {
    if (this.stream.destroy) {
      this.stream.destroy(reason);
    }

    this.stream.off('data', this.enqueue);
    this.stream.off('error', this.error);
    this.stream.off('end', this.close);
    this.stream.off('close', this.close);
  }

  enqueue(chunk) {
    if (this.controller) {
      try {
        let bytes = chunk instanceof Uint8Array ? chunk : Buffer.from(chunk);

        let available = (this.controller.desiredSize || 0) - bytes.byteLength;
        this.controller.enqueue(bytes);
        if (available <= 0) {
          this.pause();
        }
      } catch (error) {
        this.controller.error(
          new Error(
            'Could not create Buffer, chunk must be of type string or an instance of Buffer, ArrayBuffer, or Array or an Array-like Object'
          )
        );
        this.cancel();
      }
    }
  }

  pause() {
    if (this.stream.pause) {
      this.stream.pause();
    }
  }

  resume() {
    if (this.stream.readable && this.stream.resume) {
      this.stream.resume();
    }
  }

  close() {
    if (this.controller) {
      this.controller.close();
      delete this.controller;
    }
  }

  error(error) {
    if (this.controller) {
      this.controller.error(error);
      delete this.controller;
    }
  }
}
