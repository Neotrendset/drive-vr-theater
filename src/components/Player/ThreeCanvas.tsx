import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { VideoFormatType } from '../../types/media';
import { FORMAT_META_MAP } from '../../utils/formatDetector';

interface ThreeCanvasProps {
  videoElement: HTMLVideoElement | null;
  format: VideoFormatType;
  anaglyphEnabled: boolean;
  gyroEnabled: boolean;
  onWebXRSupportChange: (supported: boolean) => void;
  onSessionStateChange: (inVR: boolean) => void;
  vrTriggerRef: React.MutableRefObject<(() => Promise<void>) | null>;
}

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D uMap;
  uniform vec4 uUvTransform; // xy: offset, zw: repeat
  uniform float uAnaglyph;   // 0.0: normal, 1.0: SBS anaglyph, 2.0: OU anaglyph
  varying vec2 vUv;

  void main() {
    if (uAnaglyph > 0.5 && uAnaglyph < 1.5) {
      // SBS Anaglyph: Left (0..0.5), Right (0.5..1.0)
      vec2 leftUv = vec2(vUv.x * 0.5, vUv.y);
      vec2 rightUv = vec2(vUv.x * 0.5 + 0.5, vUv.y);
      vec4 leftCol = texture2D(uMap, leftUv);
      vec4 rightCol = texture2D(uMap, rightUv);
      gl_FragColor = vec4(leftCol.r, rightCol.g, rightCol.b, 1.0);
      return;
    }

    if (uAnaglyph >= 1.5) {
      // OU Anaglyph: Top/Left (0.5..1.0), Bottom/Right (0.0..0.5)
      vec2 leftUv = vec2(vUv.x, vUv.y * 0.5 + 0.5);
      vec2 rightUv = vec2(vUv.x, vUv.y * 0.5);
      vec4 leftCol = texture2D(uMap, leftUv);
      vec4 rightCol = texture2D(uMap, rightUv);
      gl_FragColor = vec4(leftCol.r, rightCol.g, rightCol.b, 1.0);
      return;
    }

    vec2 transformedUv = vUv * uUvTransform.zw + uUvTransform.xy;
    gl_FragColor = texture2D(uMap, transformedUv);
  }
`;

function createEyeMaterial(
  texture: THREE.VideoTexture,
  offset: [number, number],
  repeat: [number, number],
  anaglyphMode: number,
  side: THREE.Side
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uUvTransform: { value: new THREE.Vector4(offset[0], offset[1], repeat[0], repeat[1]) },
      uAnaglyph: { value: anaglyphMode },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side,
  });
}

function buildGeometry(
  format: VideoFormatType,
  videoWidth: number,
  videoHeight: number
): { geometry: THREE.BufferGeometry; side: THREE.Side; isFlat: boolean } {
  const meta = FORMAT_META_MAP[format];

  if (meta.is360) {
    const geo = new THREE.SphereGeometry(500, 64, 32);
    geo.scale(-1, 1, 1);
    return { geometry: geo, side: THREE.FrontSide, isFlat: false };
  }

  if (meta.is180) {
    const geo = new THREE.SphereGeometry(500, 64, 32, Math.PI, Math.PI, 0, Math.PI);
    geo.scale(-1, 1, 1);
    return { geometry: geo, side: THREE.FrontSide, isFlat: false };
  }

  // FLAT_2D / FLAT_SBS / FLAT_OU
  let aspect = 16 / 9;
  if (videoWidth > 0 && videoHeight > 0) {
    if (format === 'FLAT_SBS') {
      aspect = (videoWidth / 2) / videoHeight;
    } else if (format === 'FLAT_OU') {
      aspect = videoWidth / (videoHeight / 2);
    } else {
      aspect = videoWidth / videoHeight;
    }
    if (!Number.isFinite(aspect) || aspect <= 0.2 || aspect > 5) {
      aspect = 16 / 9;
    }
  }

  const height = 10;
  const width = height * aspect;
  const geo = new THREE.PlaneGeometry(width, height);
  return { geometry: geo, side: THREE.FrontSide, isFlat: true };
}

export function ThreeCanvas({
  videoElement,
  format,
  anaglyphEnabled,
  gyroEnabled,
  onWebXRSupportChange,
  onSessionStateChange,
  vrTriggerRef,
}: ThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneGroupRef = useRef<THREE.Group | null>(null);
  const textureRef = useRef<THREE.VideoTexture | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // 시점 제어 상태
  const lonRef = useRef(-90); // -Z 정면
  const latRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, lon: -90, lat: 0 });
  const gyroEnabledRef = useRef(gyroEnabled);
  const gyroQuatRef = useRef<THREE.Quaternion | null>(null);

  useEffect(() => {
    gyroEnabledRef.current = gyroEnabled;
    if (!gyroEnabled) {
      gyroQuatRef.current = null;
    }
  }, [gyroEnabled]);

  // WebXR 지원 여부 확인
  useEffect(() => {
    let mounted = true;
    if ('xr' in navigator && navigator.xr) {
      navigator.xr
        .isSessionSupported('immersive-vr')
        .then((supported) => {
          if (mounted) onWebXRSupportChange(supported);
        })
        .catch(() => {
          if (mounted) onWebXRSupportChange(false);
        });
    } else {
      onWebXRSupportChange(false);
    }
    return () => {
      mounted = false;
    };
  }, [onWebXRSupportChange]);

  // Three.js 렌더러/씬/카메라 초기화
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070e);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1200);
    camera.layers.enable(1);
    cameraRef.current = camera;

    const group = new THREE.Group();
    scene.add(group);
    sceneGroupRef.current = group;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // WebXR 세션 토글 트리거 등록
    vrTriggerRef.current = async () => {
      if (!navigator.xr) return;
      const currentSession = renderer.xr.getSession();
      if (currentSession) {
        await currentSession.end();
        return;
      }
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor'],
      });
      await renderer.xr.setSession(session);
      onSessionStateChange(true);
      session.addEventListener('end', () => {
        onSessionStateChange(false);
      });
    };

    const target = new THREE.Vector3();

    renderer.setAnimationLoop(() => {
      if (renderer.xr.isPresenting) {
        const xrCam = renderer.xr.getCamera();
        if (xrCam.cameras && xrCam.cameras.length >= 2) {
          xrCam.cameras[0].layers.set(1);
          xrCam.cameras[1].layers.set(2);
        }
      } else if (gyroEnabledRef.current && gyroQuatRef.current) {
        camera.quaternion.copy(gyroQuatRef.current);
      } else {
        const clampedLat = Math.max(-85, Math.min(85, latRef.current));
        const phi = THREE.MathUtils.degToRad(90 - clampedLat);
        const theta = THREE.MathUtils.degToRad(lonRef.current);

        target.x = 500 * Math.sin(phi) * Math.cos(theta);
        target.y = 500 * Math.cos(phi);
        target.z = 500 * Math.sin(phi) * Math.sin(theta);
        camera.lookAt(target);
      }

      renderer.render(scene, camera);
    });

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      vrTriggerRef.current = null;
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      const activeSession = renderer.xr.getSession();
      if (activeSession) {
        void activeSession.end();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onSessionStateChange, vrTriggerRef]);

  // 비디오 텍스처 및 포맷별 메시(구형/반구형/평면 + SBS/OU 양안 레이어) 구성
  useEffect(() => {
    const group = sceneGroupRef.current;
    if (!group || !videoElement) return;

    const disposeGroup = () => {
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    };

    const texture = new THREE.VideoTexture(videoElement);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    textureRef.current = texture;

    const rebuildMeshes = () => {
      disposeGroup();

      const meta = FORMAT_META_MAP[format];
      const { geometry, side, isFlat } = buildGeometry(
        format,
        videoElement.videoWidth,
        videoElement.videoHeight
      );

      // 평면 모드일 때는 정면(-Z)으로 시점 초기화
      if (isFlat) {
        lonRef.current = -90;
        latRef.current = 0;
      }

      if (!meta.isStereo) {
        const mat = createEyeMaterial(texture, [0, 0], [1, 1], 0, side);
        const mesh = new THREE.Mesh(geometry, mat);
        if (isFlat) mesh.position.set(0, 0, -14);
        mesh.layers.enable(1);
        mesh.layers.enable(2);
        group.add(mesh);
      } else {
        const isSBS = meta.stereoLayout === 'SBS';
        const leftOffset: [number, number] = isSBS ? [0, 0] : [0, 0.5];
        const leftRepeat: [number, number] = isSBS ? [0.5, 1] : [1, 0.5];
        const rightOffset: [number, number] = isSBS ? [0.5, 0] : [0, 0];
        const rightRepeat: [number, number] = isSBS ? [0.5, 1] : [1, 0.5];

        const anaglyphMode = anaglyphEnabled ? (isSBS ? 1.0 : 2.0) : 0.0;

        // 좌안 메시 (일반 화면 layer 1 + VR 좌안 layer 1)
        const leftMat = createEyeMaterial(
          texture,
          leftOffset,
          leftRepeat,
          anaglyphMode,
          side
        );
        const leftMesh = new THREE.Mesh(geometry, leftMat);
        if (isFlat) leftMesh.position.set(0, 0, -14);
        leftMesh.layers.set(1);
        group.add(leftMesh);

        // 우안 메시 (VR 우안 layer 2)
        const rightMat = createEyeMaterial(texture, rightOffset, rightRepeat, 0, side);
        const rightMesh = new THREE.Mesh(geometry, rightMat);
        if (isFlat) rightMesh.position.set(0, 0, -14);
        rightMesh.layers.set(2);
        group.add(rightMesh);
      }
    };

    rebuildMeshes();

    const handleLoadedMetadata = () => {
      if (!FORMAT_META_MAP[format].is360 && !FORMAT_META_MAP[format].is180) {
        rebuildMeshes();
      }
    };

    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      disposeGroup();
      texture.dispose();
      textureRef.current = null;
    };
  }, [videoElement, format, anaglyphEnabled]);

  // 마우스/터치 드래그 및 휠 FOV 줌
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        lon: lonRef.current,
        lat: latRef.current,
      };
      container.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const sensitivity = 0.16;
      lonRef.current =
        (dragStartRef.current.x - e.clientX) * sensitivity + dragStartRef.current.lon;
      latRef.current = Math.max(
        -85,
        Math.min(85, (e.clientY - dragStartRef.current.y) * sensitivity + dragStartRef.current.lat)
      );
    };

    const handlePointerUp = (e: PointerEvent) => {
      isDraggingRef.current = false;
      if (container.hasPointerCapture(e.pointerId)) {
        container.releasePointerCapture(e.pointerId);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const camera = cameraRef.current;
      if (!camera) return;
      const nextFov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.05, 30, 110);
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    };

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('pointercancel', handlePointerUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointercancel', handlePointerUp);
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // 모바일 자이로스코프 연동
  useEffect(() => {
    if (!gyroEnabled) return;

    const zee = new THREE.Vector3(0, 0, 1);
    const euler = new THREE.Euler();
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
      const beta = event.beta ? THREE.MathUtils.degToRad(event.beta) : 0;
      const gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0;
      const orient = window.screen.orientation
        ? THREE.MathUtils.degToRad(window.screen.orientation.angle)
        : 0;

      euler.set(beta, alpha, -gamma, 'YXZ');
      const quat = new THREE.Quaternion();
      quat.setFromEuler(euler);
      quat.multiply(q1);
      quat.multiply(q0.setFromAxisAngle(zee, -orient));
      gyroQuatRef.current = quat;
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [gyroEnabled]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
    />
  );
}
