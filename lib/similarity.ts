import { Keypoint, Pose } from './poseData';

/**
 * Calculate torso size (distance between left_shoulder and right_hip)
 * Used as reference for normalizing keypoint distances
 */
export function calculateTorsoSize(pose: Pose): number {
  const leftShoulder = pose[5];
  const rightHip = pose[12];

  if (!leftShoulder || !rightHip) return 1;

  const dx = rightHip.x - leftShoulder.x;
  const dy = rightHip.y - leftShoulder.y;

  return Math.sqrt(dx * dx + dy * dy) || 1;
}

/**
 * Calculate Euclidean distance between two keypoints
 */
export function keypointDistance(kp1: Keypoint, kp2: Keypoint): number {
  const dx = kp2.x - kp1.x;
  const dy = kp2.y - kp1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate similarity score between two poses
 * Returns a value between 0-100
 *
 * Method:
 * 1. For each keypoint, calculate distance between user and target
 * 2. Normalize by torso size to handle scale differences
 * 3. Average all distances
 * 4. Convert to similarity: 100 - (avgDistance * scaleFactor)
 */
export function calculatePoseSimilarity(
  userPose: Pose,
  targetPose: Pose,
  scaleFactor: number = 50
): number {
  if (userPose.length !== targetPose.length || userPose.length === 0) {
    return 0;
  }

  // Calculate torso size for normalization
  const torsoSize = calculateTorsoSize(userPose);

  let totalDistance = 0;
  let validKeypoints = 0;

  for (let i = 0; i < userPose.length; i++) {
    const userKp = userPose[i];
    const targetKp = targetPose[i];

    // Skip low-confidence detections
    if ((userKp.score !== undefined && userKp.score < 0.3) ||
        (targetKp.score !== undefined && targetKp.score < 0.3)) {
      continue;
    }

    const distance = keypointDistance(userKp, targetKp);
    // Normalize by torso size
    const normalizedDistance = distance / torsoSize;
    totalDistance += normalizedDistance;
    validKeypoints++;
  }

  if (validKeypoints === 0) return 0;

  const avgDistance = totalDistance / validKeypoints;
  const similarity = 100 - (avgDistance * scaleFactor * 100);

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, similarity));
}
