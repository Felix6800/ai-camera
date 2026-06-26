# AI Camera Pose Guidance - 实时骨骼检测与姿势引导

## 1. Project Overview

- **Type**: Web Application (Next.js 14 + TypeScript)
- **Core Functionality**: Real-time human body skeleton detection with pose guidance and scene recognition
- **Target Users**: Users who want to learn/follow specific poses (e.g., photography poses)
- **Theme**: Dark mode, mobile-first vertical layout

## 2. Technical Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **ML Model**: TensorFlow.js MoveNet (SinglePose Lightning - 17 keypoints)
- **Styling**: Tailwind CSS
- **State Management**: React hooks (useState, useEffect, useRef)
- **Scene Recognition**: Qwen API (qwen3.5-plus) via REST API

## 3. Visual & Rendering Specification

### 3.1 Camera Layer
- Full-screen camera video feed (back camera preferred on mobile)
- 16:9 aspect ratio centered, cropped to fill
- Mirror mode for natural selfie feel

### 3.2 Skeleton Overlay
- **User skeleton**: Green lines (#22c55e) connecting 17 keypoints
- **Target skeleton**: White semi-transparent (#ffffff40) ghost skeleton
- **Keypoints**: 8px circles at each joint
- **Lines**: 3px stroke width

### 3.3 UI Elements
- **FPS counter**: Top-right corner, small gray text
- **Similarity score**: Bottom center, large text with percentage
- **Perfect pose indicator**: Green border glow when score > 80
- **Pose buttons**: Bottom horizontal strip, 3 placeholder buttons
- **Score bar**: Visual progress bar showing current score

### 3.4 Color Palette
```
Background: #0a0a0a
Surface: #1a1a1a
Primary (green): #22c55e
Text: #ffffff
Text secondary: #9ca3af
Border: #2a2a2a
```

## 4. MoveNet Integration

### 17 Keypoints (COCO format)
```
0: nose, 1: left_eye, 2: right_eye, 3: left_ear, 4: right_ear,
5: left_shoulder, 6: right_shoulder, 7: left_elbow, 8: right_elbow,
9: left_wrist, 10: right_wrist, 11: left_hip, 12: right_hip,
13: left_knee, 14: right_knee, 15: left_ankle, 16: right_ankle
```

### Skeleton Connections
```
[0,1], [0,2], [1,3], [2,4], [5,6], [5,7], [7,9], [6,8], [8,10],
[5,11], [6,12], [11,12], [11,13], [12,14], [13,15], [14,16]
```

## 5. Pose Similarity Calculation

### Method: Keypoint Distance Matching
1. For each keypoint pair between user and target:
   - Calculate Euclidean distance
   - Normalize by torso size (to handle scale differences)
2. Average all distances
3. Convert to similarity score: `100 - (avgDistance * 100)`
4. Clamp to 0-100 range

### Torso Size Reference
- Calculated as distance between left_shoulder and right_hip

## 6. Target Poses (Placeholder Data)

### Pose 1: "回眸" (Look Back)
Classic pose with body turned, head looking over shoulder

### Pose 2: "站立" (Standing)
Neutral standing pose with arms relaxed

### Pose 3: "举手" (Arms Up)
Both arms raised above head

## 7. Interaction Specification

### Camera Permissions
- Auto-request camera on page load
- Show error message if denied

### Pose Switching
- Tap bottom buttons to switch target pose
- Active pose button highlighted

## 8. Scene Recognition

### 8.1 Overview
- Automatically analyzes the camera frame every 5 seconds
- Calls Qwen API to detect the current scene
- Matches recommended poses from local pose library

### 8.2 Supported Scenes
- 海边 (Beach)
- 街道 (Street)
- 公园 (Park)
- 咖啡厅 (Cafe)
- 山景 (Mountain)
- 室内 (Indoor)

### 8.3 Scene Recognition Flow
1. Capture video frame as base64 JPEG
2. Send to Qwen API with scene classification prompt
3. Parse response to identify scene
4. Query local pose library for matching poses
5. Display top 3 recommended poses on right panel

### 8.4 Environment Variables
```
NEXT_PUBLIC_QWEN_API_KEY=<api-key>
NEXT_PUBLIC_QWEN_MODEL=qwen3.5-plus
NEXT_PUBLIC_QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

## 9. Performance Targets

- Target FPS: 30fps
- Detection latency: < 50ms per frame
- Smooth skeleton drawing without flicker
- Scene analysis interval: 5 seconds

## 10. File Structure

```
ai_camera/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── CameraView.tsx
│   ├── SkeletonOverlay.tsx
│   ├── PoseGuide.tsx
│   ├── PoseSelector.tsx
│   └── RecommendedPoses.tsx
├── lib/
│   ├── movenet.ts
│   ├── poseData.ts
│   ├── similarity.ts
│   ├── sceneRecognition.ts
│   └── poseLibrary.json
├── .env
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── SPEC.md
```

## 11. Acceptance Criteria

1. ✅ Camera opens and displays live feed
2. ✅ Skeleton is detected and drawn in real-time
3. ✅ FPS counter shows current frame rate
4. ✅ Target pose ghost skeleton visible
5. ✅ Similarity score calculates and displays
6. ✅ Green border appears when score > 80
7. ✅ Pose can be switched via buttons
8. ✅ Works on mobile in portrait mode
9. ✅ Dark theme throughout
10. ✅ Scene recognition every 5 seconds
11. ✅ Right panel shows recommended poses based on scene
12. ✅ Clicking recommended pose switches active pose
