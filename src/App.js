import { FaceMesh } from "@mediapipe/face_mesh";
import React, { useRef, useEffect } from "react";
import * as Facemesh from "@mediapipe/face_mesh";
import * as cam from "@mediapipe/camera_utils";
import Webcam from "react-webcam";

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const connect = window.drawConnectors;
  const dlandmark = window.drawLandmarks;
  var camera = null;

  function onResults(results) {
    // const video = webcamRef.current.video;
    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    // Set canvas width
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext("2d");

    //Some angle line detection variables
    let face_2d = [];
    let points = [1, 33, 263, 61, 291, 199];
    var pointsObj = [
      0,
      -1.126865,
      7.475604, // nose 1
      -4.445859,
      2.663991,
      3.173422, //left eye corner 33
      4.445859,
      2.663991,
      3.173422, //right eye corner 263
      -2.456206,
      -4.342621,
      4.283884, // left mouth corner 61
      2.456206,
      -4.342621,
      4.283884, // right mouth corner 291
      0,
      -9.403378,
      4.264492,
    ];

    // Draw the over lays
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasElement.width,
      canvasElement.height
    );

    let width = results.image.width;
    let height = results.image.height;
    let roll = 0;
    let pitch = 0;
    let yaw = 0;
    let x, y, z;

    let normalizedFocaleY = 1.28; // Logitech 922
    let focalLength = height * normalizedFocaleY;
    let s = 0; //0.953571;
    let cx = width / 2;
    let cy = height / 2;

    if (results.multiFaceLandmarks) {
      console.log(results);
      for (const landmarks of results.multiFaceLandmarks) {
        connect(canvasCtx, landmarks, Facemesh.FACEMESH_TESSELATION, {
          color: "#C0C0C070",
          lineWidth: 1,
        });
        //Translate into a 2D face data
        for (const point of points) {
          let point0 = landmarks[point];
          dlandmark(canvasCtx, [point0], { color: "#FFFFFF", lineWidth: 0 });
          let x = point0.x * width;
          let y = point0.y * height;
          face_2d.push(x);
          face_2d.push(y);
        }
      }
    }
    canvasCtx.restore();
  }
  // }

  // setInterval(())
  useEffect(() => {
    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      refineLandmarks: true,
    });

    faceMesh.onResults(onResults);

    if (
      typeof webcamRef.current !== "undefined" &&
      webcamRef.current !== null
    ) {
      camera = new cam.Camera(webcamRef.current.video, {
        onFrame: async () => {
          await faceMesh.send({ image: webcamRef.current.video });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }
  }, []);
  return (
    <center>
      <div className="App">
        <Webcam
          ref={webcamRef}
          style={{
            position: "absolute",
            marginLeft: "auto",
            marginRight: "auto",
            left: 0,
            right: 0,
            textAlign: "center",
            zindex: 9,
            width: 640,
            height: 480,
          }}
        />{" "}
        <canvas
          ref={canvasRef}
          className="output_canvas"
          style={{
            position: "absolute",
            marginLeft: "auto",
            marginRight: "auto",
            left: 0,
            right: 0,
            textAlign: "center",
            zindex: 9,
            width: 640,
            height: 480,
          }}
        ></canvas>
      </div>
    </center>
  );
}

export default App;
