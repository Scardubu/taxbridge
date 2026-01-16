// Define __DEV__ for React Native compatibility
global.__DEV__ = true;

// Mock expo-constants to silence test warnings
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      name: 'TaxBridge',
      slug: 'taxbridge',
      version: '1.0.0',
    },
    manifest: {},
    platform: { ios: {}, android: {}, web: {} },
  },
}));

// Mock React Native core components - complete mock without requiring actual RN
jest.mock('react-native', () => {
  const React = require('react');
  
  // Create mock components that render their children
  const mockComponent = (name) => {
    const MockedComp = (props) => {
      return React.createElement(name, props, props.children);
    };
    MockedComp.displayName = name;
    return MockedComp;
  };
  
  return {
    NativeModules: {
      SettingsManager: { settings: {} },
      PlatformConstants: { getConstants: () => ({}) },
      UIManager: {
        setLayoutAnimationEnabledExperimental: jest.fn(),
        measure: jest.fn(),
        measureInWindow: jest.fn(),
        measureLayout: jest.fn(),
      },
    },
    Platform: {
      OS: 'ios',
      select: (obj) => obj.ios || obj.default,
      Version: 14,
    },
    SafeAreaView: mockComponent('SafeAreaView'),
    View: mockComponent('View'),
    Text: mockComponent('Text'),
    TextInput: mockComponent('TextInput'),
    TouchableOpacity: mockComponent('TouchableOpacity'),
    TouchableHighlight: mockComponent('TouchableHighlight'),
    TouchableWithoutFeedback: mockComponent('TouchableWithoutFeedback'),
    Pressable: mockComponent('Pressable'),
    ScrollView: mockComponent('ScrollView'),
    KeyboardAvoidingView: mockComponent('KeyboardAvoidingView'),
    FlatList: mockComponent('FlatList'),
    SectionList: mockComponent('SectionList'),
    Image: mockComponent('Image'),
    ImageBackground: mockComponent('ImageBackground'),
    ActivityIndicator: mockComponent('ActivityIndicator'),
    Modal: mockComponent('Modal'),
    Button: mockComponent('Button'),
    Switch: mockComponent('Switch'),
    StatusBar: mockComponent('StatusBar'),
    StyleSheet: {
      create: (styles) => styles,
      flatten: (style) => style,
      hairlineWidth: 1,
      absoluteFill: {},
      absoluteFillObject: {},
    },
    Alert: { alert: jest.fn() },
    Dimensions: {
      get: () => ({ width: 375, height: 812 }),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    PixelRatio: {
      get: () => 2,
      getFontScale: () => 1,
      getPixelSizeForLayoutSize: (size) => size * 2,
      roundToNearestPixel: (size) => size,
    },
    Animated: {
      View: mockComponent('Animated.View'),
      Text: mockComponent('Animated.Text'),
      Image: mockComponent('Animated.Image'),
      ScrollView: mockComponent('Animated.ScrollView'),
      Value: jest.fn(() => ({
        setValue: jest.fn(),
        interpolate: jest.fn(() => ({})),
        addListener: jest.fn(),
        removeListener: jest.fn(),
      })),
      timing: jest.fn(() => ({ start: jest.fn((cb) => cb && cb()) })),
      spring: jest.fn(() => ({ start: jest.fn((cb) => cb && cb()) })),
      decay: jest.fn(() => ({ start: jest.fn((cb) => cb && cb()) })),
      parallel: jest.fn(() => ({ start: jest.fn((cb) => cb && cb()) })),
      sequence: jest.fn(() => ({ start: jest.fn((cb) => cb && cb()) })),
      event: jest.fn(() => jest.fn()),
      createAnimatedComponent: (comp) => comp,
    },
    Keyboard: {
      dismiss: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      removeListener: jest.fn(),
    },
    Linking: {
      openURL: jest.fn(),
      canOpenURL: jest.fn(() => Promise.resolve(true)),
      getInitialURL: jest.fn(() => Promise.resolve(null)),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      removeEventListener: jest.fn(),
    },
    I18nManager: {
      isRTL: false,
      allowRTL: jest.fn(),
      forceRTL: jest.fn(),
    },
    AccessibilityInfo: {
      isScreenReaderEnabled: jest.fn(() => Promise.resolve(false)),
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
  };
});

// Mock AsyncStorage globally for all tests
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = {};
  return {
    getItem: jest.fn((key) => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key, value) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
      return Promise.resolve();
    }),
    getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
    multiGet: jest.fn((keys) =>
      Promise.resolve(keys.map((k) => [k, store[k] ?? null]))
    ),
    multiSet: jest.fn((entries) => {
      entries.forEach(([k, v]) => {
        store[k] = v;
      });
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
      return Promise.resolve();
    }),
  };
});

// Mock react-i18next to avoid initialization errors
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: {
      changeLanguage: jest.fn(),
      language: 'en',
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
}));

// Mock react-native-safe-area-context to avoid SafeAreaView issues
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock react-native-reanimated to avoid native worklets initialization
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text, Image, ScrollView } = require('react-native');
  
  // Create a chainable animation builder mock
  const createAnimationMock = () => {
    const mock = {
      duration: () => mock,
      delay: () => mock,
      springify: () => mock,
      damping: () => mock,
      mass: () => mock,
      stiffness: () => mock,
      overshootClamping: () => mock,
      restDisplacementThreshold: () => mock,
      restSpeedThreshold: () => mock,
      withInitialValues: () => mock,
      withCallback: () => mock,
      easing: () => mock,
      build: () => mock,
    };
    return mock;
  };

  // Create mock animated components
  const createAnimatedComponent = (Component) => {
    const AnimatedComponent = React.forwardRef((props, ref) => {
      return React.createElement(Component, { ...props, ref });
    });
    AnimatedComponent.displayName = `Animated(${Component.displayName || Component.name || 'Component'})`;
    return AnimatedComponent;
  };

  // Pre-create animated versions of common components
  const AnimatedView = createAnimatedComponent(View);
  const AnimatedText = createAnimatedComponent(Text);
  const AnimatedImage = createAnimatedComponent(Image);
  const AnimatedScrollView = createAnimatedComponent(ScrollView);

  // Return the mock as the default export and named exports
  const mockReanimated = {
    // Animated namespace with components
    View: AnimatedView,
    Text: AnimatedText,
    Image: AnimatedImage,
    ScrollView: AnimatedScrollView,
    createAnimatedComponent,
    // Hooks
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedReaction: jest.fn(),
    useDerivedValue: (fn) => ({ value: fn() }),
    useAnimatedGestureHandler: () => ({}),
    useAnimatedScrollHandler: () => jest.fn(),
    // Animation functions
    withSpring: (v) => v,
    withTiming: (v) => v,
    withDelay: (_, v) => v,
    withSequence: (...args) => args[0],
    withRepeat: (v) => v,
    cancelAnimation: jest.fn(),
    // Worklet utilities
    runOnUI: (fn) => fn,
    runOnJS: (fn) => fn,
    // Interpolation
    interpolate: (value, inputRange, outputRange) => outputRange[0],
    interpolateColor: (_value, _inputRange, outputRange) => outputRange[0],
    // Animation presets (entering/exiting animations)
    FadeIn: createAnimationMock(),
    FadeOut: createAnimationMock(),
    FadeInUp: createAnimationMock(),
    FadeInDown: createAnimationMock(),
    FadeInLeft: createAnimationMock(),
    FadeInRight: createAnimationMock(),
    FadeOutUp: createAnimationMock(),
    FadeOutDown: createAnimationMock(),
    FadeOutLeft: createAnimationMock(),
    FadeOutRight: createAnimationMock(),
    SlideInUp: createAnimationMock(),
    SlideInDown: createAnimationMock(),
    SlideInLeft: createAnimationMock(),
    SlideInRight: createAnimationMock(),
    SlideOutUp: createAnimationMock(),
    SlideOutDown: createAnimationMock(),
    SlideOutLeft: createAnimationMock(),
    SlideOutRight: createAnimationMock(),
    ZoomIn: createAnimationMock(),
    ZoomOut: createAnimationMock(),
    BounceIn: createAnimationMock(),
    BounceOut: createAnimationMock(),
    // Layout animations
    Layout: createAnimationMock(),
    LinearTransition: createAnimationMock(),
    // Easing
    Easing: {
      linear: (x) => x,
      ease: (x) => x,
      quad: (x) => x,
      cubic: (x) => x,
      poly: () => (x) => x,
      sin: (x) => x,
      circle: (x) => x,
      exp: (x) => x,
      elastic: () => (x) => x,
      back: () => (x) => x,
      bounce: (x) => x,
      bezier: () => (x) => x,
      in: (fn) => fn,
      out: (fn) => fn,
      inOut: (fn) => fn,
    },
  };
  
  return {
    __esModule: true,
    default: mockReanimated,
    ...mockReanimated,
  };
});

// Mock expo-modules-core to provide EventEmitter and permission hook used by expo-camera
jest.mock('expo-modules-core', () => {
  return {
    createPermissionHook: () => [null, jest.fn()],
    requireOptionalNativeModule: () => null,
    NativeModulesProxy: {},
    EventEmitter: class {
      addListener() { return { remove: () => {} }; }
      removeAllListeners() {}
    },
  };
});

// Mock expo-camera to avoid ESM/native imports during Jest runs
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');

  // Legacy Camera component
  const Camera = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      takePictureAsync: jest.fn(async () => ({ uri: 'file://mock-camera.jpg' })),
    }));
    return React.createElement(View, props, props.children);
  });

  Camera.requestCameraPermissionsAsync = jest.fn(async () => ({ status: 'granted' }));
  
  // New CameraView component (expo-camera v15+)
  const CameraView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      takePictureAsync: jest.fn(async () => ({ uri: 'file://mock-camera.jpg' })),
    }));
    return React.createElement(View, props, props.children);
  });

  CameraView.requestCameraPermissionsAsync = jest.fn(async () => ({ status: 'granted' }));

  const CameraType = { back: 'back', front: 'front' };

  // useCameraPermissions hook mock
  const useCameraPermissions = () => {
    return [
      { granted: true, status: 'granted', canAskAgain: true },
      jest.fn(async () => ({ granted: true, status: 'granted', canAskAgain: true })),
    ];
  };

  return {
    Camera,
    CameraView,
    CameraType,
    useCameraPermissions,
  };
});

// Mock expo-image-picker used by the CreateInvoiceScreen
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  MediaTypeOptions: { Images: 'Images' },
}));

// Mock expo-sqlite for database tests
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    getAllAsync: jest.fn(() => Promise.resolve([])),
    runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    prepareSync: jest.fn(() => ({
      execute: jest.fn(),
      executeAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
    })),
    execAsync: jest.fn(() => Promise.resolve()),
  })),
  openDatabaseAsync: jest.fn(() => Promise.resolve({
    getAllAsync: jest.fn(() => Promise.resolve([])),
    runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    execAsync: jest.fn(() => Promise.resolve()),
  })),
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  cacheDirectory: '/mock/cache/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
  deleteAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
}));

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
  addEventListener: jest.fn(() => jest.fn()),
  useNetInfo: jest.fn(() => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }) => children,
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

// Mock @react-navigation/bottom-tabs
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: jest.fn(() => ({
    Navigator: ({ children }) => children,
    Screen: ({ children }) => children,
  })),
}));
