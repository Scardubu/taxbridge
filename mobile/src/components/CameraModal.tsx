import { Modal } from 'react-native';
import { ARCameraView } from './ocr/ARCameraView';

interface CameraModalProps {
  visible: boolean;
  facing: 'front' | 'back';
  onCapture: (uri: string) => void;
  onFlip: () => void;
  onClose: () => void;
}

export default function CameraModal({
  visible,
  facing,
  onCapture,
  onFlip,
  onClose,
}: CameraModalProps) {
  return (
    <Modal visible={visible} animationType="slide">
      <ARCameraView
        onCapture={onCapture}
        onClose={onClose}
        facing={facing}
        onFlip={onFlip}
      />
    </Modal>
  );
}