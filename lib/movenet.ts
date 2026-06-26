import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

let detector: poseDetection.PoseDetector | null = null;
let modelLoaded = false;
let initPromise: Promise<void> | null = null;

// CDN URL for MoveNet model - using jsDelivr mirror for better speed in China
const MOVENET_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/movenet_model';

let modelLoadingTimeout: NodeJS.Timeout | null = null;

/**
 * Pre-warm TensorFlow.js and preload MoveNet model in background
 * Call this early during app initialization
 */
export async function warmUp(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[MoveNet] Warming up TensorFlow.js...');

    // Initialize TensorFlow.js
    await tf.ready();
    console.log('[MoveNet] TensorFlow.js ready, backend:', tf.getBackend());

    // Try to set WebGL backend
    try {
      if (tf.getBackend() !== 'webgl') {
        await tf.setBackend('webgl');
      }
    } catch (e) {
      console.warn('[MoveNet] WebGL not available, using default backend:', e);
    }

    console.log('[MoveNet] Backend set to:', tf.getBackend());

    // Create detector with timeout
    const model = poseDetection.SupportedModels.MoveNet;
    const detectorConfig: poseDetection.MoveNetModelConfig = {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      enableSmoothing: true,
    };

    console.log('[MoveNet] Loading MoveNet model from CDN...');
    const loadPromise = poseDetection.createDetector(model, detectorConfig);

    // Add 30 second timeout
    const timeoutPromise = new Promise<null>((_, reject) => {
      modelLoadingTimeout = setTimeout(() => {
        reject(new Error('Model loading timed out after 30s'));
      }, 30000);
    });

    try {
      detector = await Promise.race([loadPromise, timeoutPromise]);
      if (detector) {
        modelLoaded = true;
        console.log('[MoveNet] Model loaded successfully');
      }
    } catch (error) {
      console.error('[MoveNet] Model loading failed:', error);
      // Try one more time with different approach
      try {
        console.log('[MoveNet] Retrying model load...');
        detector = await loadPromise;
        modelLoaded = true;
        console.log('[MoveNet] Model loaded on retry');
      } catch (retryError) {
        console.error('[MoveNet] Retry also failed:', retryError);
        throw retryError;
      }
    } finally {
      if (modelLoadingTimeout) {
        clearTimeout(modelLoadingTimeout);
        modelLoadingTimeout = null;
      }
    }
  })();

  return initPromise;
}

/**
 * Initialize MoveNet detector
 */
export async function initDetector(): Promise<void> {
  if (detector) return;
  await warmUp();
  if (!detector) {
    throw new Error('Failed to initialize pose detector');
  }
}

/**
 * Detect poses in a video frame
 */
export async function detectPose(
  video: HTMLVideoElement
): Promise<poseDetection.Pose[]> {
  if (!detector) {
    await initDetector();
  }

  if (!detector || !modelLoaded) {
    return [];
  }

  try {
    const poses = await detector.estimatePoses(video, {
      flipHorizontal: false,
    });
    return poses;
  } catch (error) {
    console.error('Pose detection error:', error);
    return [];
  }
}

/**
 * Check if model is loaded
 */
export function isModelLoaded(): boolean {
  return modelLoaded;
}
