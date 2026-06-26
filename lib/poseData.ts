import poseLibrary from './poseLibrary.json';

// COCO 17-keypoint format
export type Keypoint = {
  x: number;
  y: number;
  score?: number;
  name?: string;
};

export type Pose = Keypoint[];

// Skeleton connections for drawing lines
export const SKELETON_CONNECTIONS: [number, number][] = [
  [0, 1],   // nose -> left_eye
  [0, 2],   // nose -> right_eye
  [1, 3],   // left_eye -> left_ear
  [2, 4],   // right_eye -> right_ear
  [5, 6],   // left_shoulder -> right_shoulder
  [5, 7],   // left_shoulder -> left_elbow
  [7, 9],   // left_elbow -> left_wrist
  [6, 8],   // right_shoulder -> right_elbow
  [8, 10],  // right_elbow -> right_wrist
  [5, 11],  // left_shoulder -> left_hip
  [6, 12],  // right_shoulder -> right_hip
  [11, 12], // left_hip -> right_hip
  [11, 13], // left_hip -> left_knee
  [12, 14], // right_hip -> right_knee
  [13, 15], // left_knee -> left_ankle
  [14, 16], // right_knee -> right_ankle
];

// Keypoint names for debugging
export const KEYPOINT_NAMES = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
];

// Target pose data - normalized to 0-1 range
export interface TargetPoseData {
  name: string;
  nameCn: string;
  icon: string;
  pose: Pose;
  scene?: string;
}

// Import poses from library JSON
interface LibraryPose {
  id: string;
  name: string;
  scene: string;
  icon: string;
  pose: Pose;
}

const libraryPoses: LibraryPose[] = poseLibrary.poses;

export const ALL_POSES: TargetPoseData[] = libraryPoses.map((p) => ({
  name: p.id,
  nameCn: p.name,
  icon: p.icon,
  pose: p.pose,
  scene: p.scene,
}));

/**
 * Get poses recommended for a specific scene
 */
export function getPosesForScene(scene: string): TargetPoseData[] {
  const matching = ALL_POSES.filter((p) => p.scene === scene);
  // Return up to 3 poses
  return matching.slice(0, 3);
}

// TARGET_POSES is now ALL_POSES (all library poses)
export const TARGET_POSES: TargetPoseData[] = ALL_POSES;
