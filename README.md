# BioLens — Mobile Biodiversity Intelligence Platform

[![CI](https://github.com/darukaa/biolens/actions/workflows/ci.yml/badge.svg)](https://github.com/darukaa/biolens/actions)
![Expo](https://img.shields.io/badge/Expo-56-blue)
![Node](https://img.shields.io/badge/Node-18+-green)
![Platform](https://img.shields.io/badge/Platform-Android-brightgreen)

## Overview

BioLens enables field ecologists and workers to identify plant species in real time using on-device Machine Learning. No internet required. Built for Darukaa.Earth's ecological data collection workflows.

Field workers capture images of vegetation; BioLens runs a highly optimized MobileNetV2 INT8 quantized model entirely on-device, delivers real-time species predictions with confidence scores, and stores structured geolocated biodiversity records locally for later CSV/PDF export.

## ML Pipeline Architecture

```
Image Capture → Preprocessing (Resize, Decode, Normalize) → Signed INT8 Quantization
→ Native TFLite Inference → Signed INT8 Output Dequantization → Softmax + Top-K
→ Species Results
```

### Pipeline Stages

| Step | Stage                     | Detail                                                                                                                                                                              | Implementation / Library                                                       |
| ---- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1    | **Image Capture**         | Expo Camera captures JPEG; saved locally with UUID filename.                                                                                                                        | `expo-camera`, `expo-file-system`                                              |
| 2    | **Preprocessing**         | Resize to 224×224. Base64 string is decoded via a custom pure JS base64 decoder and parsed using `jpeg-js` into raw RGBA bytes. Pixel values are normalized to the `[-1, 1]` range. | `expo-image-manipulator`, `jpeg-js`                                            |
| 3    | **Input Quantization**    | Map Float32 `[-1, 1]` values into Signed INT8 `[-128, 127]` array using model scale (`0.007843135`) and zero-point (`-1`). An ArrayBuffer slice is passed synchronously to TFLite.  | Custom logic in [ml/model.ts](file:///D:/Projects/Darukaa/biolens/ml/model.ts) |
| 4    | **Inference**             | Load model synchronous runner; execute inference using CPU delegate.                                                                                                                | `react-native-fast-tflite`                                                     |
| 5    | **Output Dequantization** | The output buffer is read using a signed `Int8Array` and dequantized back into Float32 logits using model scale (`0.16345862`) and zero-point (`127`).                              | Custom logic in [ml/model.ts](file:///D:/Projects/Darukaa/biolens/ml/model.ts) |
| 6    | **Post-processing**       | Computes a numerically stable softmax over all 1081 species logits, extracts the Top-3 highest-confidence species, and matches them to labels.                                      | [ml/postprocess.ts](file:///D:/Projects/Darukaa/biolens/ml/postprocess.ts)     |

---

### Model: MobileNetV2 (Quantized INT8)

| Property            | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| **Architecture**    | MobileNetV2 (depthwise separable convolutions)                 |
| **Model File**      | `assets/models/mobilenet_v2_plant.tflite`                      |
| **Input Shape**     | `[1, 224, 224, 3]` — Signed INT8 image tensor                  |
| **Output Shape**    | `[1, 1081]` — Signed INT8 logits per species                   |
| **Model Size**      | **3.93 MB** (Quantized INT8) / original is ~13.74 MB (Float32) |
| **Inference Speed** | ~50–120 ms on mid-range Android devices                        |
| **Label Count**     | 1081 plant species                                             |

---

## Quick Start & Running the Project

### Prerequisites

- **Node.js 18+**
- **EAS CLI** (`npm install -g eas-cli`)
- **Android Device** (Custom Development Client is required. Custom C++ native modules **do not run inside standard Expo Go**).

## Installation

### Prerequisites

- Node.js 18+
- Android Studio with Android SDK installed
- Android device with USB debugging enabled or an Android emulator

### 1. Clone the repository and install dependencies

```bash
git clone <your-repository-url>
cd biolens
npm install
```

### 2. Configure the Android SDK

Create `android/local.properties` and set the Android SDK path:

```properties
sdk.dir=C:/Users/<YOUR_USERNAME>/AppData/Local/Android/Sdk
```

> Replace `<YOUR_USERNAME>` with your Windows username.

### 3. Build and run the application

Connect an Android device (USB debugging enabled) or start an emulator, then run:

```bash
npx expo run:android
```

The command will build the native Android application, install it on the connected device/emulator, and launch it automatically.

### 4. Start the Metro development server (if required)

```bash
npx expo start
```

> **Important:** Expo Go is **not supported**. BioLens uses `react-native-fast-tflite` and native TensorFlow Lite modules for on-device ML inference, which require a native Android build.

---

## How to Build the Android APK

Because this app utilizes native C++ wrappers (`react-native-fast-tflite` Nitro Modules), it cannot run in the generic Expo Go client. You must build a standalone APK.

### Step 1: Install EAS CLI and Log In

```bash
npm install -g eas-cli
eas login
```

### Step 2: Configure EAS Build

```bash
eas build:configure
```

_(Select `Android` when prompted. This will generate `eas.json` in your project root)._

### Step 3: Configure `eas.json` for APK builds

Ensure your `eas.json` has `buildType` configured as `apk` under the `preview` profile:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### Step 4: Run the Build

Run the build on EAS cloud servers (which are pre-configured with the required Android NDK and CMake compilers):

```bash
eas build --platform android --profile preview
```

Once compilation is complete, EAS will output a QR code and URL link to download the installable `.apk` file directly onto your Android device.

---

## Project Structure

```
biolens/
├── app/                      ← Expo Router screens
│   ├── _layout.tsx           ← Root layout with navigation
│   ├── index.tsx             ← Welcome & Profile selection (Ecologist/Admin)
│   ├── camera.tsx            ← Camera & capture screen (Ecology capture)
│   ├── results.tsx           ← ML prediction results screen (Confirm/Reject)
│   ├── admin.tsx             ← Admin Dashboard (Stats, Shannon Index, Site comparisons)
│   └── history.tsx           ← Offline observations history list screen
├── components/               ← Reusable UI components
│   ├── PredictionCard.tsx    ← Species + confidence card
│   ├── ImageStrip.tsx        ← Multi-image thumbnail strip
│   └── ConfidenceBar.tsx     ← Visual confidence bar
├── ml/                       ← All ML-related pipeline code
│   ├── model.ts              ← TFLite loading, quantization, and inference
│   ├── preprocess.ts         ← Base64 decode (pure JS) & normalization to [-1, 1]
│   ├── postprocess.ts        ← Numerically-stable softmax & top-K sorting
│   └── labels.json           ← 1081 PlantNet species name mapping
├── store/                    ← Zustand state management
│   └── observationStore.ts   ← Observations state management (Zustand v5 + AsyncStorage)
├── utils/                    ← Helper utilities
│   ├── geoLocation.ts        ← GPS location permissions and capture
│   ├── ecology.ts            ← Shannon Index (H') & biodiversity metrics
│   ├── exportCsv.ts          ← CSV data export
│   └── exportPdf.ts          ← PDF reports generation
├── assets/
│   └── models/
│       └── mobilenet_v2_plant.tflite   ← 3.93 MB INT8 Quantized model
├── .github/workflows/
│   └── ci.yml                ← GitHub Actions (Prettier, ESLint, type-checking)
├── .eslintrc.js
├── .prettierrc
├── app.json
├── package.json
└── README.md
```

---

## Technical Features & Implementation Details

- **Pure JS Base64 Decoder**: React Native's Hermes engine does not expose the browser global `atob()`. Image base64 data is parsed back to bytes using an optimized, zero-dependency Javascript decoder inside the preprocessing step.
- **On-Device INT8 Inference**: Fast synchronous ML model calls via React Native JSI (JavaScript Interface), achieving highly optimized inference times (<100ms) on-device.
- **Defensive Quantization Handling**: The pipeline features fallback configurations (scales and zero-points) to maintain model stability across various architectures and configurations.
- **Offline-First Storage**: Saves all records locally using Zustand v5 mapped to React Native's `AsyncStorage`.
- **Ecology Analytics**: Automatically calculates the **Shannon Biodiversity Index ($H'$)**, unique species counts, and site comparisons directly on-device.
- **Data Exporting**: Export all captured offline vegetation observation data as CSV or PDF report formats.

## APK Download

The latest Android APK build can be downloaded from:

https://expo.dev/accounts/aaryy/projects/biolens/builds/82f0d66a-32de-4154-865f-02c97918c7a1

## License

MIT
