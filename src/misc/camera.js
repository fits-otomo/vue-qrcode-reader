import adapterFactory from "webrtc-adapter/src/js/adapter_factory.js";
import { StreamApiNotSupportedError, InsecureContextError } from "./errors.js";
import { imageDataFromVideo } from "./image-data.js";
import { eventOn } from "callforth";
import path from 'path';
import fs from 'fs';

class Camera {
  constructor(videoEl, stream) {
    this.videoEl = videoEl;
    this.stream = stream;
  }

  stop() {
    this.stream.getTracks().forEach(track => track.stop());
  }

  captureFrame() {
    return imageDataFromVideo(this.videoEl);
  }
}

const INSECURE_CONTEXT = window.isSecureContext !== true;

const STREAM_API_NOT_SUPPORTED = !(
  navigator &&
  (navigator.getUserMedia ||
    (navigator.mediaDevices && navigator.mediaDevices.getUserMedia))
);

let streamApiShimApplied = false;


let filepath = path.join(process.env.APPDATA, '/my-project/test.json');
let data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
const WebCam = data.device.qr;

export default async function(constraints, videoEl) {
  // At least in Chrome `navigator.mediaDevices` is undefined when the page is
  // loaded using HTTP rather than HTTPS. Thus `STREAM_API_NOT_SUPPORTED` is
  // initialized with `false` although the API might actually be supported.
  // So although `getUserMedia` already should have a build-in mechanism to
  // detect insecure context (by throwing `NotAllowedError`), we have to do a
  // manual check before even calling `getUserMedia`.
  if (INSECURE_CONTEXT) {
    throw new InsecureContextError();
  }

  if (STREAM_API_NOT_SUPPORTED) {
    throw new StreamApiNotSupportedError();
  }

  if (streamApiShimApplied === false) {
    adapterFactory({ window });
    streamApiShimApplied = true;
  }

  let camDeviceId = '';
  await navigator.mediaDevices.enumerateDevices().then(function (devices) {
    devices.some(function (device) {
      if (device.label === WebCam) {
        console.log(device.label);
        camDeviceId = device.deviceId;
        return true;
      }
    })
  })
  constraints.video.deviceId = camDeviceId;

  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  if (videoEl.srcObject !== undefined) {
    videoEl.srcObject = stream;
  } else if (videoEl.mozSrcObject !== undefined) {
    videoEl.mozSrcObject = stream;
  } else if (window.URL.createObjectURL) {
    videoEl.src = window.URL.createObjectURL(stream);
  } else if (window.webkitURL) {
    videoEl.src = window.webkitURL.createObjectURL(stream);
  } else {
    videoEl.src = stream;
  }

  await eventOn(videoEl, "loadeddata");

  return new Camera(videoEl, stream);
}
