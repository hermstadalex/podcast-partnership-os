import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });
if (typeof Request === 'undefined') {
  global.Request = class Request {};
}
if (typeof Response === 'undefined') {
  global.Response = class Response {};
}
if (typeof Headers === 'undefined') {
  global.Headers = class Headers {};
}
