import { FaceMesh } from "@mediapipe/face_mesh";
import React, { useRef, useEffect } from "react";
import * as Facemesh from "@mediapipe/face_mesh";
import * as cam from "@mediapipe/camera_utils";
import Webcam from "react-webcam";
import cv from "@techstark/opencv-js";

function FaceDetect() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const connect = window.drawConnectors;
  const dlandmark = window.drawLandmarks;
  let camera = useRef(null);

  function onResults(results) {
    // const video = webcamRef.current.video;
    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    // Set canvas width
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext("2d");

    //Some angle line detection letiables
    let face_2d = [];
    let points = [1, 33, 263, 61, 291, 199];
    let pointsObj = [
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

    //Camera intrinsic values
    let cam_matrix = cv.matFromArray(3, 3, cv.CV_64FC1, [
      focalLength,
      s,
      cx,
      0,
      focalLength,
      cy,
      0,
      0,
      1,
    ]);

    //Assuming no lens distortion
    let k1 = 0.1318020374;
    let k2 = -0.1550007612;
    let p1 = -0.0071350401;
    let p2 = -0.0096747708;
    let dist_matrix = cv.matFromArray(4, 1, cv.CV_64FC1, [k1, k2, p1, p2]);

    if (results.multiFaceLandmarks) {
      // console.log(results);
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

    if (face_2d.length > 0) {
      // Initial guess
      //Rotation in axis-angle form
      let rvec = new cv.Mat(); // = cv.matFromArray(1, 3, cv.CV_64FC1, [0, 0, 0]); //new cv.Mat({ width: 1, height: 3 }, cv.CV_64FC1); // Output rotation vector
      let tvec = new cv.Mat(); // = cv.matFromArray(1, 3, cv.CV_64FC1, [-100, 100, 1000]); //new cv.Mat({ width: 1, height: 3 }, cv.CV_64FC1); // Output translation vector

      const numRows = points.length;
      const imagePoints = cv.matFromArray(numRows, 2, cv.CV_64FC1, face_2d);

      let modelPointsObj = cv.matFromArray(6, 3, cv.CV_64FC1, pointsObj);

      //console.log("modelPointsObj : " + modelPointsObj.data64F);
      //console.log("imagePoints : " + imagePoints.data64F);

      // https://docs.opencv.org/4.6.0/d9/d0c/group__calib3d.html#ga549c2075fac14829ff4a58bc931c033d
      // https://docs.opencv.org/4.6.0/d5/d1f/calib3d_solvePnP.html
      let success = cv.solvePnP(
        modelPointsObj, //modelPoints,
        imagePoints,
        cam_matrix,
        dist_matrix,
        rvec, // Output rotation vector
        tvec,
        false, //  uses the provided rvec and tvec values as initial approximations
        cv.SOLVEPNP_ITERATIVE //SOLVEPNP_EPNP //SOLVEPNP_ITERATIVE (default but pose seems unstable)
      );

      if (success) {
        let rmat = cv.Mat.zeros(3, 3, cv.CV_64FC1);
        const jaco = new cv.Mat();

        console.log("rvec", rvec.data64F[0], rvec.data64F[1], rvec.data64F[2]);
        console.log("tvec", tvec.data64F[0], tvec.data64F[1], tvec.data64F[2]);

        // Get rotational matrix rmat
        cv.Rodrigues(rvec, rmat, jaco); // jacobian	Optional output Jacobian matrix

        let sy = Math.sqrt(
          rmat.data64F[0] * rmat.data64F[0] + rmat.data64F[3] * rmat.data64F[3]
        );

        let singular = sy < 1e-6;

        // we need decomposeProjectionMatrix

        if (!singular) {
          //console.log("!singular");
          x = Math.atan2(rmat.data64F[7], rmat.data64F[8]);
          y = Math.atan2(-rmat.data64F[6], sy);
          z = Math.atan2(rmat.data64F[3], rmat.data64F[0]);
        } else {
          console.log("singular");
          x = Math.atan2(-rmat.data64F[5], rmat.data64F[4]);
          //  x = Math.atan2(rmat.data64F[1], rmat.data64F[2]);
          y = Math.atan2(-rmat.data64F[6], sy);
          z = 0;
        }

        roll = y;
        pitch = x;
        yaw = z;

        let worldPoints = cv.matFromArray(9, 3, cv.CV_64FC1, [
          modelPointsObj.data64F[0] + 3,
          modelPointsObj.data64F[1],
          modelPointsObj.data64F[2], // x axis
          modelPointsObj.data64F[0],
          modelPointsObj.data64F[1] + 3,
          modelPointsObj.data64F[2], // y axis
          modelPointsObj.data64F[0],
          modelPointsObj.data64F[1],
          modelPointsObj.data64F[2] - 3, // z axis
          modelPointsObj.data64F[0],
          modelPointsObj.data64F[1],
          modelPointsObj.data64F[2], //
          modelPointsObj.data64F[3],
          modelPointsObj.data64F[4],
          modelPointsObj.data64F[5], //
          modelPointsObj.data64F[6],
          modelPointsObj.data64F[7],
          modelPointsObj.data64F[8], //
          modelPointsObj.data64F[9],
          modelPointsObj.data64F[10],
          modelPointsObj.data64F[11], //
          modelPointsObj.data64F[12],
          modelPointsObj.data64F[13],
          modelPointsObj.data64F[14], //
          modelPointsObj.data64F[15],
          modelPointsObj.data64F[16],
          modelPointsObj.data64F[17], //
        ]);

        //console.log("worldPoints : " + worldPoints.data64F);

        let imagePointsProjected = new cv.Mat(
          { width: 9, height: 2 },
          cv.CV_64FC1
        );
        cv.projectPoints(
          worldPoints, // TODO object points that never change !
          rvec,
          tvec,
          cam_matrix,
          dist_matrix,
          imagePointsProjected,
          jaco
        );

        // Draw pose

        // canvasCtx.lineWidth = 5;

        // let scaleX = canvasElement.width / width;
        // let scaleY = canvasElement.height / height;

        // canvasCtx.strokeStyle = "red";
        // canvasCtx.beginPath();
        // canvasCtx.moveTo(
        //   imagePointsProjected.data64F[6] * scaleX,
        //   imagePointsProjected.data64F[7] * scaleX
        // );
        // canvasCtx.lineTo(
        //   imagePointsProjected.data64F[0] * scaleX,
        //   imagePointsProjected.data64F[1] * scaleY
        // );
        // canvasCtx.closePath();
        // canvasCtx.stroke();

        // canvasCtx.strokeStyle = "green";
        // canvasCtx.beginPath();
        // canvasCtx.moveTo(
        //   imagePointsProjected.data64F[6] * scaleX,
        //   imagePointsProjected.data64F[7] * scaleX
        // );
        // canvasCtx.lineTo(
        //   imagePointsProjected.data64F[2] * scaleX,
        //   imagePointsProjected.data64F[3] * scaleY
        // );
        // canvasCtx.closePath();
        // canvasCtx.stroke();

        // canvasCtx.strokeStyle = "blue";
        // canvasCtx.beginPath();
        // canvasCtx.moveTo(
        //   imagePointsProjected.data64F[6] * scaleX,
        //   imagePointsProjected.data64F[7] * scaleX
        // );
        // canvasCtx.lineTo(
        //   imagePointsProjected.data64F[4] * scaleX,
        //   imagePointsProjected.data64F[5] * scaleY
        // );
        // canvasCtx.closePath();
        // canvasCtx.stroke();

        // https://developer.mozilla.org/en-US/docs/Web/CSS/named-color
        // canvasCtx.fillStyle = "aqua";

        // for (let i = 6; i <= 6 + 6 * 2; i += 2) {
        //   canvasCtx.rect(
        //     imagePointsProjected.data64F[i] * scaleX - 5,
        //     imagePointsProjected.data64F[i + 1] * scaleY - 5,
        //     10,
        //     10
        //   );
        //   canvasCtx.fill();
        // }

        jaco.delete();
        imagePointsProjected.delete();
      }

      canvasCtx.fillStyle = "black";
      canvasCtx.font = "bold 30px Arial";
      canvasCtx.fillText(
        "roll: " + (180.0 * (roll / Math.PI)).toFixed(2),
        //"roll: " + roll.toFixed(2),
        width * 0.8,
        40
      );
      canvasCtx.fillText(
        "pitch: " + (180.0 * (pitch / Math.PI)).toFixed(2),
        //"pitch: " + pitch.toFixed(2),
        width * 0.8,
        80
      );
      canvasCtx.fillText(
        "yaw: " + (180.0 * (yaw / Math.PI)).toFixed(2),
        //"yaw: " + yaw.toFixed(3),
        width * 0.8,
        120
      );
      let realRoll = (180.0 * (roll / Math.PI)).toFixed(2);
      let realPitch = (180.0 * (pitch / Math.PI)).toFixed(2);
      let realYaw = (180.0 * (yaw / Math.PI)).toFixed(2);

      if (realRoll <= 0.02) {
        canvasCtx.fillText("PERFECT POSE ", width * 0.8, 190);
      }

      console.log("pose %f %f %f", realRoll, realPitch, realYaw);

      rvec.delete();
      tvec.delete();
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
      camera.current = new cam.Camera(webcamRef.current.video, {
        onFrame: async () => {
          await faceMesh.send({ image: webcamRef.current.video });
        },
        width: 640,
        height: 480,
      });
      camera.current.start();
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

const App = () => {
  return <FaceDetect />;
};
export default App;
