import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/addons/loaders/3MFLoader.js";

const parameterSchema = [
  ["head_width", "Head width", "Overall fit width", 118, 172, 1, "mm"],
  ["bridge_width", "Nose bridge", "Nose clearance", 12, 30, 0.5, "mm"],
  ["lens_width", "Lens width", "Single lens opening", 40, 64, 0.5, "mm"],
  ["lens_height", "Lens height", "Lens opening height", 28, 50, 0.5, "mm"],
  ["rim_thickness", "Rim thickness", "Material around lens", 2.5, 9, 0.1, "mm"],
  ["frame_depth", "Front depth", "Extrusion depth", 3, 12, 0.1, "mm"],
  ["temple_length", "Temple length", "Arm length", 115, 175, 1, "mm"],
  ["temple_drop", "Temple drop", "Behind-ear hook", 0, 42, 1, "mm"],
  ["temple_spread", "Temple spread", "Temple opening angle", 0, 28, 0.5, "°"],
  ["nose_pad_width", "Nose pad width", "Support surface", 3, 14, 0.5, "mm"],
  ["nose_pad_drop", "Nose pad position", "Support offset", 0, 18, 0.5, "mm"],
  ["hinge_width", "Hinge width", "Side block", 3, 16, 0.5, "mm"],
  ["corner_radius", "Corner radius", "Lens corner radius", 2, 14, 0.5, "mm"],
  ["bevel", "Bevel", "Soft printable edge", 0, 2.4, 0.1, "mm"]
];

const visibleParameterKeys = new Set(["bridge_width", "head_width", "temple_length"]);

const translations = {
  en: {
    brandKicker: "",
    navLabel: "Navigation",
    accountKicker: "Account",
    accountHeading: "Frame Lab access",
    accountEmailPlaceholder: "you@example.com",
    signInAccount: "Login",
    signOutAccount: "Sign out",
    closeAccount: "Close",
    accountFreeNote: "No active plan: configure models freely, then choose a plan to export 3MF.",
    accountBasicNote: "Basic: 15 3MF downloads per month.",
    accountProNote: "Pro: 50 3MF downloads per month.",
    accountPlusNote: "Plus: unlimited 3MF downloads.",
    accountDeveloperNote: "Developer: full access, collection management and deletion.",
    lockedModel: "Plan required to download",
    upgrade: "Plan",
    tabHome: "Start",
    tabConfigurator: "Editor",
    tabGallery: "Collections",
    tabStudio: "Developer",
    heroKicker: "",
    heroTitle: "Your next frame is 3D printed.",
    heroText: "Choose a collection, combine a front with temples, and prepare a clean production kit for additive manufacturing.",
    heroBrowse: "View collections",
    heroEditor: "Open editor",
    builderKicker: "",
    builderHeading: "Components",
    frameSize: "Frame size",
    frontComponent: "Front",
    leftTempleComponent: "Left temple",
    rightTempleComponent: "Right temple",
    componentSize: "Size",
    componentCompatible: "Compatible connector",
    componentWarning: "Check hinge compatibility",
    paramsKicker: "Parameters",
    fitHeading: "Fit",
    reset: "Reset",
    productionKicker: "",
    productionHeading: "Export",
    generate3mf: "3MF",
    generateStl: "STL",
    downloadAssembly: "Download kit",
    saveModel: "Save model",
    exportScad: ".scad",
    exportJson: "JSON",
    copyScad: "Copy",
    readyLog: "Ready.",
    libraryKicker: "Collections",
    galleryHeading: "Choose a frame base",
    sunHeading: "Sunglasses",
    sunMeta: "",
    opticalHeading: "Optical",
    opticalMeta: "",
    studioKicker: "Developer",
    studioHeading: "Collection manager",
    frameEditorKicker: "Frame editor",
    frameEditorHeading: "Frame workspace",
    backToDeveloper: "Back to Developer",
    collectionTitlePlaceholder: "Collection title",
    collectionDescriptionPlaceholder: "Short description",
    sunCategory: "Sunglasses",
    opticalCategory: "Optical",
    chooseImage: "Photo",
    addScad: ".scad file",
    frontModelFile: "Front variants",
    templeModelFile: "Temple models",
    leftTempleModelFile: "Left temples",
    rightTempleModelFile: "Right temples",
    lensModelFile: "Lens models",
    addCollection: "Add to gallery",
    componentImportKicker: "Components",
    componentImportHeading: "Add option to selected collection",
    componentNamePlaceholder: "Component name",
    connectorPlaceholder: "Connector",
    templeComponent: "Temple",
    leftSide: "Left",
    rightSide: "Right",
    universalSide: "Universal",
    lensComponent: "Lens",
    noLensComponent: "No lens model selected",
    chooseCadFile: "Choose 3MF / STEP",
    addComponentFile: "Add component",
    noComponents: "No STEP/3MF files added yet.",
    storedLocally: "Saved",
    activeModel: "Active model",
    scadFile: ".scad file",
    open: "Configure",
    variants: "Options",
    export: "Export",
    delete: "Delete",
    moveLeft: "Left",
    moveRight: "Right",
    newCollection: "New collection",
    editingCollection: "Editing",
    heroTitlePlaceholder: "Hero title",
    heroTextPlaceholder: "Hero text",
    heroImageFile: "Hero image",
    parametersDetected: "params",
    param_head_width_label: "Head width",
    param_head_width_hint: "Overall fit width",
    param_bridge_width_label: "Nose bridge",
    param_bridge_width_hint: "Clearance at the nose",
    param_temple_length_label: "Temple length",
    param_temple_length_hint: "Arm length",
    loader3mfTitle: "Generating 3MF",
    loader3mfText: "Packing the current geometry for production...",
    loaderStlTitle: "Generating STL",
    loaderStlText: "Writing the current geometry...",
    savedModel: "Saved model to gallery",
    resetLog: "Parameters restored to the production baseline.",
    exportedScad: "Exported OpenSCAD file.",
    exportedJson: "Exported parameter JSON.",
    copiedScad: "Copied OpenSCAD source to clipboard."
  }
};

const defaultParams = {
  head_width: 150,
  bridge_width: 18,
  lens_width: 52,
  lens_height: 37,
  rim_thickness: 5.2,
  frame_depth: 5.8,
  temple_length: 145,
  temple_drop: 30,
  temple_spread: 8,
  nose_pad_width: 8,
  nose_pad_drop: 7,
  hinge_width: 8.5,
  corner_radius: 8,
  bevel: 0.55
};

const designParameterGroups = {
  front: [
    ["head_width", "Frame width"],
    ["bridge_width", "Bridge opening"],
    ["lens_width", "Lens opening"],
    ["lens_height", "Lens height"],
    ["rim_thickness", "Rim thickness"],
    ["frame_depth", "Front depth"],
    ["corner_radius", "Corner radius"],
    ["bevel", "Edge bevel"]
  ],
  temples: [
    ["temple_length", "Temple length"],
    ["temple_drop", "Ear hook drop"],
    ["temple_spread", "Temple angle"],
    ["hinge_width", "Hinge width"],
    ["nose_pad_width", "Nose support"],
    ["nose_pad_drop", "Pad offset"]
  ]
};
const defaultDesignStyle = {
  lensShape: "soft-square",
  templePattern: "none",
  templeText: "",
  browBar: true,
  frameColor: "#ff741f",
  lensColor: "#202529",
  detailColor: "#e59a62"
};

const defaultModelId = "frame001-sun-01";
const ownerDeveloperEmail = "nyderek@framelab.dev";
const adminEmails = new Set([ownerDeveloperEmail, "s.nyderek@proton.me"]);
const defaultAccentColor = "#c96b34";
const defaultHeroImage = "./assets/frame-lab-hero.png";
const defaultPrintGuideImage = "./assets/print-guide-honeycomb.svg";
const defaultColorSlots = ["#ff741f", "#2d2b27", "#f1eee9", "#0f1010", "#8f8b82"];
const defaultContentSettings = {
  plans: [
    {
      plan: "basic",
      name: "Basic",
      price: "$20",
      period: "/ month",
      exports: "15 3MF downloads per month",
      description: "Full configurator access for personal prints and fit tests."
    },
    {
      plan: "pro",
      name: "Pro",
      price: "$45",
      period: "/ month",
      exports: "50 3MF downloads per month",
      description: "More exports for active makers preparing several variants."
    },
    {
      plan: "studio",
      name: "Plus",
      price: "$60",
      period: "/ month",
      exports: "Unlimited 3MF downloads",
      description: "Unlimited production exports for heavy use and early studio access."
    }
  ],
  sizes: {
    heading: "Sizes",
    intro: "Pick the size from your face width, nose bridge and preferred temple length. The recommendation is a starting point for 3D printed test fits.",
    rows: [
      { size: "S", label: "Narrow", headMin: 125, headMax: 137, frameWidth: "126-134 mm", lensWidth: "49-52 mm", bridgeMin: 14, bridgeMax: 17, templeMin: 130, templeMax: 140, note: "Slim faces and smaller nose bridges." },
      { size: "M", label: "Regular", headMin: 138, headMax: 149, frameWidth: "135-144 mm", lensWidth: "52-55 mm", bridgeMin: 17, bridgeMax: 20, templeMin: 140, templeMax: 150, note: "Most adult fits and balanced sunglasses proportions." },
      { size: "L", label: "Wide", headMin: 150, headMax: 162, frameWidth: "145-155 mm", lensWidth: "55-59 mm", bridgeMin: 20, bridgeMax: 23, templeMin: 150, templeMax: 160, note: "Wider heads, stronger wrap and longer temples." }
    ]
  },
  printGuide: {
    heading: "How to print it",
    intro: "Use any stiff filament for the frame. For lenses, cut the exported lens template from 1 mm clear acrylic, or print lens inserts with honeycomb infill and 0 top and bottom shell layers.",
    image: defaultPrintGuideImage
  },
  roadmap: {
    heading: "Roadmap",
    items: [
      { title: "Crowdfunding release", status: "Next", description: "Backer codes, stable exports and first production-ready sunglasses." },
      { title: "Lens library", status: "Planned", description: "Printable lens placeholders and templates for cutting transparent sheet lenses." },
      { title: "Fit calibration", status: "Planned", description: "Guided measurements with size recommendations stored in each account." }
    ]
  },
  license: {
    heading: "License",
    body: "Backer access codes unlock downloads according to the selected tier. Personal use is included by default; commercial use can be reserved for a higher tier if needed."
  },
  faq: {
    heading: "FAQ",
    items: [
      { question: "Can I configure before I unlock a plan?", answer: "Yes. All frames can be configured first; downloads unlock after activating a code." },
      { question: "What files do I receive?", answer: "The export is a clean 3MF production file for the selected front, temples, lenses and colors." },
      { question: "How should I make the lenses?", answer: "Use the lens template to cut 1 mm clear acrylic, or print honeycomb lens inserts for a printed texture effect." }
    ]
  }
};
const defaultBrandSettings = {
  accentColor: defaultAccentColor,
  backgroundColor: "#0c0d0d",
  surfaceColor: "#141616",
  textColor: "#f1eee9",
  mutedColor: "#9a9690",
  borderColor: "#292c2c",
  sceneColor: "#070909",
  heroTitle: "Your next frame is 3D printed.",
  heroText: "Choose a collection, combine a front with temples, and prepare a clean production kit for additive manufacturing.",
  heroImage: "",
  heroModelId: "",
  content: structuredClone(defaultContentSettings)
};
const accountStorageKey = "framelab.account.v1";
const sessionStorageKey = "framelab.sessionToken.v1";
const accountProfilesStorageKey = "framelab.accounts.v1";
const hiddenComponentsStorageKey = "framelab.hiddenComponents.v1";
const brandSettingsStorageKey = "framelab.brandSettings.v1";
const colorSlotsStorageKey = "framelab.colorSlots.v1";
const planRank = { free: 0, basic: 1, pro: 2, studio: 3 };
const licenseCodeTypes = {
  basic_month: { label: "Basic / 1 month", plan: "basic", duration: "month" },
  pro_month: { label: "Pro / 1 month", plan: "pro", duration: "month" },
  plus_month: { label: "Plus / 1 month", plan: "studio", duration: "month" },
  basic_year: { label: "Basic / 1 year", plan: "basic", duration: "year" },
  pro_year: { label: "Pro / 1 year", plan: "pro", duration: "year" },
  plus_year: { label: "Plus / 1 year", plan: "studio", duration: "year" },
  basic_lifetime: { label: "Basic / lifetime", plan: "basic", duration: "lifetime" },
  pro_lifetime: { label: "Pro / lifetime", plan: "pro", duration: "lifetime" },
  plus_lifetime: { label: "Plus / lifetime", plan: "studio", duration: "lifetime" }
};
const seedCollections = [
  {
    id: defaultModelId,
    name: "Frame 001",
    category: "sun",
    access: "basic",
    description: "First production-ready modular frame kit.",
    params: { head_width: 150, bridge_width: 18, lens_width: 52, lens_height: 37, temple_length: 145 },
    order: 0
  }
];

const baseComponentLibrary = {
  fronts: [],
  temples: [],
  lenses: []
};

const legacyModelIds = new Set([
  "openframe-rx-01",
  "sun-arc-02",
  "sun-block-03",
  "sun-coast-04",
  "sun-field-05",
  "optical-line-01",
  "optical-soft-02",
  "optical-narrow-03",
  "optical-wide-04",
  "optical-studio-05"
]);

const componentLibrary = {
  fronts: [],
  temples: [],
  lenses: []
};

const sampleScad = `// Frame Lab OpenSCAD eyewear template
// Edit these values in the browser or directly in OpenSCAD.

head_width = 150;      // [118:1:172]
bridge_width = 18;    // [12:0.5:30]
lens_width = 52;      // [40:0.5:64]
lens_height = 37;     // [28:0.5:50]
rim_thickness = 5.2;  // [2.5:0.1:9]
frame_depth = 5.8;    // [3:0.1:12]
temple_length = 145;  // [115:1:175]
temple_drop = 30;     // [0:1:42]
temple_spread = 8;    // [0:0.5:28]
nose_pad_width = 8;   // [3:0.5:14]
nose_pad_drop = 7;    // [0:0.5:18]
hinge_width = 8.5;    // [3:0.5:16]
corner_radius = 8;    // [2:0.5:14]
bevel = 0.55;         // [0:0.1:2.4]

module rounded_square_2d(size=[10,10], r=2) {
  offset(r=r) square([size[0]-2*r, size[1]-2*r], center=true);
}

module lens_rim(cx=0) {
  translate([cx, 0, 0])
  linear_extrude(height=frame_depth, center=true, convexity=8)
  difference() {
    rounded_square_2d([lens_width + rim_thickness*2.15, lens_height + rim_thickness*2.05], corner_radius + rim_thickness*0.9);
    rounded_square_2d([lens_width, lens_height], corner_radius);
  }
}

module soft_bar(size=[10,4,4], r=1) {
  linear_extrude(height=size[2], center=true, convexity=4)
  rounded_square_2d([size[0], size[1]], r);
}

module brow_bar() {
  total_width = bridge_width + lens_width*2 + rim_thickness*5.3;
  translate([0, lens_height/2 + rim_thickness*0.72, 0.05])
  soft_bar([total_width, rim_thickness*1.05, frame_depth*0.95], rim_thickness*0.45);
}

module bridge() {
  translate([0, lens_height*0.08, 0])
  soft_bar([bridge_width + rim_thickness*2.35, rim_thickness*1.15, frame_depth], rim_thickness*0.35);
}

module nose_pads() {
  for (side=[-1,1])
  translate([side*(bridge_width/2 + nose_pad_width/2), -lens_height/4 - nose_pad_drop/4, -frame_depth/2])
  rotate([0, 0, side*10])
  soft_bar([nose_pad_width, rim_thickness*1.45, frame_depth*0.72], rim_thickness*0.35);
}

module temple(side=1) {
  lens_center = (bridge_width + lens_width) / 2;
  hinge_x = side * (lens_center + lens_width/2 + rim_thickness + hinge_width/2);
  spread = side * temple_spread;
  translate([hinge_x, lens_height*0.28, -frame_depth*0.08])
  rotate([0, spread, 0])
  union() {
    soft_bar([hinge_width, rim_thickness*1.7, frame_depth*1.2], rim_thickness*0.32);
    for (slot=[-1,1])
    translate([side*hinge_width*0.52, slot*rim_thickness*0.42, -frame_depth*0.78])
    rotate([0, 90, 0])
    cylinder(h=hinge_width*0.95, r=rim_thickness*0.34, center=true, $fn=20);
    translate([side*hinge_width*0.34, 0.2, -temple_length/2 - frame_depth*0.5])
    soft_bar([rim_thickness*1.25, rim_thickness*1.05, temple_length], rim_thickness*0.32);
    translate([side*hinge_width*0.34, -temple_drop*0.28, -temple_length - frame_depth*0.5 - temple_drop*0.28])
    rotate([-28, 0, 0])
    soft_bar([rim_thickness*1.3, rim_thickness*1.05, temple_drop], rim_thickness*0.32);
  }
}

module glasses() {
  lens_center = (bridge_width + lens_width) / 2;
  union() {
    lens_rim(-lens_center);
    lens_rim(lens_center);
    brow_bar();
    bridge();
    nose_pads();
    temple(-1);
    temple(1);
  }
}

glasses();
`;

const modelStorageKey = "framelab.openscadModels.v1";
const componentDbName = "framelab-component-files";
const componentStoreName = "components";
const seedComponentAssets = [
  {
    id: "frame001-front",
    name: "Frame 001 Front",
    kind: "front",
    size: "M",
    connector: "FL-H8",
    format: "3mf",
    fileName: "frame-001-front.3mf",
    assetUrl: "./assets/test-models/frame-001-front.3mf",
    source: "asset"
  },
  {
    id: "frame001-temple-left",
    name: "Frame 001 Temple Left",
    kind: "temple",
    size: "M",
    connector: "FL-H8",
    format: "3mf",
    fileName: "frame-001-temple-left.3mf",
    assetUrl: "./assets/test-models/frame-001-temple-left.3mf",
    templeSide: "left",
    source: "asset"
  },
  {
    id: "frame001-temple-right",
    name: "Frame 001 Temple Right",
    kind: "temple",
    size: "M",
    connector: "FL-H8",
    format: "3mf",
    fileName: "frame-001-temple-right.3mf",
    assetUrl: "./assets/test-models/frame-001-temple-right.3mf",
    templeSide: "right",
    source: "asset"
  },
  {
    id: "frame001-no-logo-temple-left",
    name: "Frame 001 No Logo Temple Left",
    kind: "temple",
    size: "M",
    connector: "FL-H8",
    format: "3mf",
    fileName: "frame-001-no-logo-temple-left.3mf",
    assetUrl: "./assets/test-models/frame-001-no-logo-temple-left.3mf",
    templeSide: "left",
    source: "asset"
  },
  {
    id: "frame001-no-logo-temple-right",
    name: "Frame 001 No Logo Temple Right",
    kind: "temple",
    size: "M",
    connector: "FL-H8",
    format: "3mf",
    fileName: "frame-001-no-logo-temple-right.3mf",
    assetUrl: "./assets/test-models/frame-001-no-logo-temple-right.3mf",
    templeSide: "right",
    source: "asset"
  }
];

const state = {
  params: structuredClone(defaultParams),
  scadSource: sampleScad,
  modelName: "Frame 001",
  meshObject: null,
  previewMode: "parametric",
  frameColor: "#2d2b27",
  models: [],
  uploadedComponents: [],
  hiddenComponentIds: new Set(),
  activeModelId: defaultModelId,
  lang: "en",
  account: {
    email: "",
    firstName: "",
    lastName: "",
    plan: "free",
	    role: "visitor",
	    subscriptionMode: "free",
	    subscriptionStatus: "none",
	    planEndsAt: null,
	    measurements: { headWidth: null, bridgeWidth: null, templeLength: null }
	  },
  pendingPlan: "basic",
  authMode: "login",
  lensMode: "none",
  downloads: [],
  downloadQuota: null,
  licenseCodes: [],
  staticLicenseCodes: [],
  editingModelId: null,
  cropImage: null,
  croppedCollectionImage: "",
  viewerRotation: { x: -0.48, y: 0.62, z: 0.03 },
  viewerPan: { x: 0, y: 0 },
  componentColors: {
    front: "",
    leftTemple: "",
    rightTemple: "",
    lens: ""
  },
  componentColorSources: {
    front: "",
    leftTemple: "",
    rightTemple: "",
    lens: ""
  },
  colorEditor: {
    type: "",
    key: "",
    index: -1,
    source: "",
    draft: ""
  },
  openComponentOptions: {
    front: true
  },
  colorSlots: [...defaultColorSlots],
  brandSettings: structuredClone(defaultBrandSettings),
  activeParametricDesign: null,
  designDraft: createDefaultDesignDraft(),
  designSubmissions: [],
  system: {
    storage: { persistent: false, source: "unknown", message: "" }
  },
  assemblySize: "M",
  assembly: {
    front: { modelId: "frame001-front", size: "M" },
    leftTemple: { modelId: "frame001-temple-left", size: "M" },
    rightTemple: { modelId: "frame001-temple-right", size: "M" },
    lens: { modelId: "", size: "M" }
  }
};

const els = {
  topbar: document.querySelector(".topbar"),
  homePage: document.querySelector("#homePage"),
  workspace: document.querySelector("#workspace"),
  designLab: document.querySelector("#designLab"),
  studioPanel: document.querySelector("#developerPanel"),
  collectionEditorPanel: document.querySelector("#collectionEditorPanel"),
  galleryPanel: document.querySelector("#galleryPanel"),
  canvas: document.querySelector("#scene"),
  designCanvas: document.querySelector("#designScene"),
  controls: document.querySelector("#controls"),
  builderControls: document.querySelector("#builderControls"),
  componentName: document.querySelector("#componentName"),
  componentKind: document.querySelector("#componentKind"),
  componentTempleSide: document.querySelector("#componentTempleSide"),
  componentSize: document.querySelector("#componentSize"),
  componentConnector: document.querySelector("#componentConnector"),
  componentFileInput: document.querySelector("#componentFileInput"),
  addComponentFile: document.querySelector("#addComponentFile"),
  componentFileList: document.querySelector("#componentFileList"),
  frameEditorPhoto: document.querySelector("#frameEditorPhoto"),
  frameEditorPhotoCaption: document.querySelector("#frameEditorPhotoCaption"),
  frameEditorComponentGallery: document.querySelector("#frameEditorComponentGallery"),
  accountPanel: document.querySelector("#accountPanel"),
  plansPanel: document.querySelector("#plansPanel"),
  licensePanel: document.querySelector("#licensePanel"),
  plansContext: document.querySelector("#plansContext"),
  accountButton: document.querySelector("#accountButton"),
  plansButton: document.querySelector("#plansButton"),
  authTitle: document.querySelector("#authTitle"),
  authModeButtons: document.querySelectorAll("[data-auth-mode]"),
  nameFields: document.querySelector("#nameFields"),
  accountFirstName: document.querySelector("#accountFirstName"),
  accountLastName: document.querySelector("#accountLastName"),
  accountEmail: document.querySelector("#accountEmail"),
  accountPassword: document.querySelector("#accountPassword"),
  accountPasswordConfirm: document.querySelector("#accountPasswordConfirm"),
  confirmPasswordField: document.querySelector("#confirmPasswordField"),
  passwordToggleButtons: document.querySelectorAll("[data-password-toggle]"),
  accountNote: document.querySelector("#accountNote"),
  authForm: document.querySelector(".auth-form"),
  accountProfile: document.querySelector("#accountProfile"),
  profileEmail: document.querySelector("#profileEmail"),
  profileName: document.querySelector("#profileName"),
  profileRole: document.querySelector("#profileRole"),
	  profilePlan: document.querySelector("#profilePlan"),
	  profileStatus: document.querySelector("#profileStatus"),
	  profileExports: document.querySelector("#profileExports"),
	  accountHeadWidth: document.querySelector("#accountHeadWidth"),
	  accountBridgeWidth: document.querySelector("#accountBridgeWidth"),
	  accountTempleLength: document.querySelector("#accountTempleLength"),
	  saveFitProfile: document.querySelector("#saveFitProfile"),
	  fitRecommendation: document.querySelector("#fitRecommendation"),
	  downloadFolder: document.querySelector("#downloadFolder"),
  licenseCodeInput: document.querySelector("#licenseCodeInput"),
  redeemLicenseCode: document.querySelector("#redeemLicenseCode"),
  licenseCodeNote: document.querySelector("#licenseCodeNote"),
  profileOpenPlans: document.querySelector("#profileOpenPlans"),
  profileSignOut: document.querySelector("#profileSignOut"),
  cancelSubscription: document.querySelector("#cancelSubscription"),
	  closeProfilePanel: document.querySelector("#closeProfilePanel"),
	  pricingGrid: document.querySelector("#pricingGrid"),
	  cropPanel: document.querySelector("#cropPanel"),
  cropCanvas: document.querySelector("#cropCanvas"),
  cropZoom: document.querySelector("#cropZoom"),
  cropX: document.querySelector("#cropX"),
  cropY: document.querySelector("#cropY"),
  cropNote: document.querySelector("#cropNote"),
  applyCrop: document.querySelector("#applyCrop"),
  cancelCrop: document.querySelector("#cancelCrop"),
  signInAccount: document.querySelector("#signInAccount"),
  signOutAccount: document.querySelector("#signOutAccount"),
  googleLogin: document.querySelector("#googleLogin"),
  closeAccountPanel: document.querySelector("#closeAccountPanel"),
  closePlansPanel: document.querySelector("#closePlansPanel"),
  planButtons: document.querySelectorAll("button[data-plan]"),
  planPickButtons: document.querySelectorAll("button[data-plan-pick]"),
  galleryGrid: document.querySelector("#galleryGrid"),
  sunGalleryGrid: document.querySelector("#sunGalleryGrid"),
  opticalGalleryGrid: document.querySelector("#opticalGalleryGrid"),
  brandHome: document.querySelector("#brandHome"),
  heroTitle: document.querySelector("#heroTitle"),
  heroText: document.querySelector("#heroText"),
  heroImage: document.querySelector("#heroImage"),
  galleryScadInput: document.querySelector("#galleryScadInput"),
  collectionTitle: document.querySelector("#collectionTitle"),
  collectionCategory: document.querySelector("#collectionCategory"),
  collectionAccess: document.querySelector("#collectionAccess"),
  collectionDescription: document.querySelector("#collectionDescription"),
  collectionImageInput: document.querySelector("#collectionImageInput"),
  collectionFrontInput: document.querySelector("#collectionFrontInput"),
  collectionLeftTempleInput: document.querySelector("#collectionLeftTempleInput"),
  collectionRightTempleInput: document.querySelector("#collectionRightTempleInput"),
  collectionLensInput: document.querySelector("#collectionLensInput"),
  addCollection: document.querySelector("#addCollection"),
	  openHome: document.querySelector("#openHome"),
	  openConfigurator: document.querySelector("#openConfigurator"),
	  openGallery: document.querySelector("#openGallery"),
	  openDesignLab: document.querySelector("#openDesignLab"),
	  openSizes: document.querySelector("#openSizes"),
	  openPrintGuide: document.querySelector("#openPrintGuide"),
	  openRoadmap: document.querySelector("#openRoadmap"),
	  openLicenseInfo: document.querySelector("#openLicenseInfo"),
	  openFaq: document.querySelector("#openFaq"),
	  openStudio: document.querySelector("#openStudio"),
  openLicenses: document.querySelector("#openLicenses"),
  startDesignLab: document.querySelector("#startDesignLab"),
  exitDesignLab: document.querySelector("#exitDesignLab"),
  designName: document.querySelector("#designName"),
  designDescription: document.querySelector("#designDescription"),
  designFrontControls: document.querySelector("#designFrontControls"),
  designTempleControls: document.querySelector("#designTempleControls"),
  designTabs: document.querySelectorAll("[data-design-tab]"),
  designOperationsPanel: document.querySelector("#designOperationsPanel"),
  designCodePanel: document.querySelector("#designCodePanel"),
  designScadCode: document.querySelector("#designScadCode"),
  regenerateDesignCode: document.querySelector("#regenerateDesignCode"),
  applyDesignCode: document.querySelector("#applyDesignCode"),
  designLensShape: document.querySelector("#designLensShape"),
  designTemplePattern: document.querySelector("#designTemplePattern"),
  designTempleText: document.querySelector("#designTempleText"),
  designBrowBar: document.querySelector("#designBrowBar"),
  designFrameColor: document.querySelector("#designFrameColor"),
  designLensColor: document.querySelector("#designLensColor"),
  designDetailColor: document.querySelector("#designDetailColor"),
  designDimensions: document.querySelector("#designDimensions"),
  designStatus: document.querySelector("#designStatus"),
  designSubmissionStatus: document.querySelector("#designSubmissionStatus"),
  resetDesign: document.querySelector("#resetDesign"),
  downloadDesignScad: document.querySelector("#downloadDesignScad"),
  submitDesign: document.querySelector("#submitDesign"),
  designSubmissionList: document.querySelector("#designSubmissionList"),
  collectionEditorHeading: document.querySelector("#collectionEditorHeading"),
  studioModeLabel: document.querySelector("#studioModeLabel"),
  clearStudioEdit: document.querySelector("#clearStudioEdit"),
  backToDeveloper: document.querySelector("#backToDeveloper"),
  newDeveloperCollection: document.querySelector("#newDeveloperCollection"),
  developerCollectionList: document.querySelector("#developerCollectionList"),
  brandAccentColor: document.querySelector("#brandAccentColor"),
  brandAccentText: document.querySelector("#brandAccentText"),
  brandBackgroundColor: document.querySelector("#brandBackgroundColor"),
  brandSurfaceColor: document.querySelector("#brandSurfaceColor"),
  brandTextColor: document.querySelector("#brandTextColor"),
  brandMutedColor: document.querySelector("#brandMutedColor"),
  brandBorderColor: document.querySelector("#brandBorderColor"),
  brandSceneColor: document.querySelector("#brandSceneColor"),
  saveBrandSettings: document.querySelector("#saveBrandSettings"),
  resetBrandSettings: document.querySelector("#resetBrandSettings"),
  heroTitleInput: document.querySelector("#heroTitleInput"),
  heroTextInput: document.querySelector("#heroTextInput"),
  heroEditorTarget: document.querySelector("#heroEditorTarget"),
  heroImageInput: document.querySelector("#heroImageInput"),
  resetHeroImage: document.querySelector("#resetHeroImage"),
  brandSettingsNote: document.querySelector("#brandSettingsNote"),
	  storageStatusNote: document.querySelector("#storageStatusNote"),
	  refreshStorageDebug: document.querySelector("#refreshStorageDebug"),
	  storageDebugPanel: document.querySelector("#storageDebugPanel"),
	  planContentEditor: document.querySelector("#planContentEditor"),
	  pageContentEditor: document.querySelector("#pageContentEditor"),
	  sizeGuideHeading: document.querySelector("#sizeGuideHeading"),
	  sizeGuideIntro: document.querySelector("#sizeGuideIntro"),
	  sizeGuideRows: document.querySelector("#sizeGuideRows"),
	  printGuideHeading: document.querySelector("#printGuideHeading"),
	  printGuideIntro: document.querySelector("#printGuideIntro"),
	  printGuideFigure: document.querySelector("#printGuideFigure"),
	  printGuideImage: document.querySelector("#printGuideImage"),
	  openPrintGuideImage: document.querySelector("#openPrintGuideImage"),
	  imageLightbox: document.querySelector("#imageLightbox"),
	  lightboxImage: document.querySelector("#lightboxImage"),
	  closeImageLightbox: document.querySelector("#closeImageLightbox"),
	  roadmapHeading: document.querySelector("#roadmapHeading"),
	  roadmapItems: document.querySelector("#roadmapItems"),
	  licenseInfoHeading: document.querySelector("#licenseInfoHeading"),
	  licenseInfoBody: document.querySelector("#licenseInfoBody"),
	  faqHeading: document.querySelector("#faqHeading"),
	  faqItems: document.querySelector("#faqItems"),
	  printGuideButton: document.querySelector("#printGuideButton"),
  licenseCodeType: document.querySelector("#licenseCodeType"),
  licenseCodeQuantity: document.querySelector("#licenseCodeQuantity"),
  generateLicenseCodes: document.querySelector("#generateLicenseCodes"),
  licenseAdminNote: document.querySelector("#licenseAdminNote"),
  licenseCodeList: document.querySelector("#licenseCodeList"),
  staticLicenseCodeList: document.querySelector("#staticLicenseCodeList"),
  heroBrowse: document.querySelector("#heroBrowse"),
  heroEditor: document.querySelector("#heroEditor"),
  saveCurrentModel: document.querySelector("#saveCurrentModel"),
  exportScad: document.querySelector("#exportScad"),
  exportJson: document.querySelector("#exportJson"),
  copyScad: document.querySelector("#copyScad"),
  generate3mf: document.querySelector("#generate3mf"),
  generateStl: document.querySelector("#generateStl"),
  downloadAssembly: document.querySelector("#downloadAssembly"),
  resetParams: document.querySelector("#resetParams"),
  renderEndpoint: document.querySelector("#renderEndpoint"),
  saveEndpoint: document.querySelector("#saveEndpoint"),
  modelName: document.querySelector("#modelName"),
  metricWidth: document.querySelector("#metricWidth"),
  metricBridge: document.querySelector("#metricBridge"),
  metricTemple: document.querySelector("#metricTemple"),
  meshStatus: document.querySelector("#meshStatus"),
  polyCount: document.querySelector("#polyCount"),
  importLog: document.querySelector("#importLog"),
  scadPreview: document.querySelector("#scadPreview"),
  loaderOverlay: document.querySelector("#loaderOverlay"),
  loaderTitle: document.querySelector("#loaderTitle"),
  loaderText: document.querySelector("#loaderText"),
  colorPickerPanel: document.querySelector("#colorPickerPanel"),
  colorPickerTitle: document.querySelector("#colorPickerTitle"),
  colorPickerInput: document.querySelector("#colorPickerInput"),
  colorPickerValue: document.querySelector("#colorPickerValue"),
  closeColorPicker: document.querySelector("#closeColorPicker"),
  cancelColorPicker: document.querySelector("#cancelColorPicker"),
  applyColorPicker: document.querySelector("#applyColorPicker"),
  viewFront: document.querySelector("#viewFront"),
  viewIso: document.querySelector("#viewIso"),
  viewSide: document.querySelector("#viewSide")
};

let scene;
let camera;
let renderer;
let modelGroup;
let modelBasePosition = new THREE.Vector3(0, 8, 0);
let dragState = null;
let triangleCount = 0;
let persistTimer = null;
let backendPersistTimer = null;
let cameraZoomScale = 1;
let viewerFitRadius = 100;
const cameraTarget = new THREE.Vector3(0, 0, 0);
let cameraBaseDistance = 250;
let cameraBaseHeight = 0;
let componentPreviewRenderers = [];
let sharedComponentPreviewRenderer = null;
let navigationScrollFrame = null;
let designScene;
let designCamera;
let designRenderer;
let designModelGroup;
let designDragState = null;
let designCameraDistance = 260;
let designZoomScale = 1;
const designCameraTarget = new THREE.Vector3();
const designViewerRotation = { x: -0.54, y: 0.56, z: 0.02 };
const bootState = window.frameLabBoot || { ready: false, editorRequested: false };

init();

async function init() {
  loadSettings();
  applyBrandSettings();
  await hydrateSystemStatus();
  await hydrateBrandSettings();
  await hydrateSessionFromBackend();
  state.uploadedComponents = [...await loadSeedComponentAssets(), ...await loadComponentRecords()]
    .filter((component) => !state.hiddenComponentIds.has(component.id));
  if (!state.uploadedComponents.some((component) => component.kind === "front") || !state.uploadedComponents.some((component) => component.kind === "temple")) {
    state.hiddenComponentIds = new Set();
    persistHiddenComponents();
    state.uploadedComponents = [...await loadSeedComponentAssets(), ...await loadComponentRecords()];
  }
  await hydrateUploadedComponentMeshes();
  rebuildComponentLibrary();
  state.models = await loadStoredModels();
  selectModel(state.models[0]?.id || defaultModelId, { rebuildControls: false, renderScene: false, logSelection: false });
  applyAssemblyToParams();
  buildBuilderControls();
  buildControls();
  buildDesignControls();
  setupScene();
  setupDesignScene();
  bindUi();
  syncComponentSideInput();
  applyTranslations();
  updateAccountUi();
  updateGeneratedSource();
  render();
  renderDesignPreview();
  renderGallery();
  setupNavigation();
  bootState.ready = true;
  if (bootState.editorRequested) {
    openHeroEditorTarget();
    showLoader(false);
  }
  animate();
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(sceneBackgroundColor());

  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 4000);
  camera.position.set(0, 70, 250);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.add(new THREE.HemisphereLight("#fff8ef", "#0b1112", 2.15));

  const key = new THREE.DirectionalLight("#ffffff", 2.8);
  key.position.set(120, 160, 120);
  scene.add(key);

  const warm = new THREE.DirectionalLight("#ff9c4a", 0.75);
  warm.position.set(-120, 50, -80);
  scene.add(warm);

  modelGroup = new THREE.Group();
  modelGroup.position.y = 8;
  modelGroup.rotation.order = "YXZ";
  scene.add(modelGroup);

  window.addEventListener("resize", resize);
  resize();
}

function createDefaultDesignDraft() {
  return {
    name: "My custom frame",
    description: "",
    params: {
      ...structuredClone(defaultParams),
      head_width: 148,
      bridge_width: 18,
      lens_width: 51,
      lens_height: 38,
      temple_length: 145
    },
    style: structuredClone(defaultDesignStyle),
    code: "",
    manualCode: false
  };
}

function normalizeDesignStyle(style = {}) {
  return {
    lensShape: ["soft-square", "round", "sharp"].includes(style.lensShape) ? style.lensShape : defaultDesignStyle.lensShape,
    templePattern: ["none", "ribs", "perforated"].includes(style.templePattern) ? style.templePattern : defaultDesignStyle.templePattern,
    templeText: String(style.templeText || "").trim().slice(0, 24),
    browBar: style.browBar !== false,
    frameColor: sanitizeHexColor(style.frameColor, defaultDesignStyle.frameColor),
    lensColor: sanitizeHexColor(style.lensColor, defaultDesignStyle.lensColor),
    detailColor: sanitizeHexColor(style.detailColor, defaultDesignStyle.detailColor)
  };
}

function designGeometryParams(params = state.designDraft.params) {
  const values = { ...structuredClone(defaultParams), ...params };
  parameterSchema.forEach(([key, , , min, max]) => {
    values[key] = THREE.MathUtils.clamp(Number(values[key]) || defaultParams[key], min, max);
  });
  const availableOpening = Math.max(28, (values.head_width - values.bridge_width) / 2 - values.rim_thickness * 2.12);
  values.lens_width = Math.min(values.lens_width, availableOpening);
  return values;
}

function setupDesignScene() {
  if (!els.designCanvas) return;
  designScene = new THREE.Scene();
  designScene.background = new THREE.Color(sceneBackgroundColor());
  designCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 4000);
  designRenderer = new THREE.WebGLRenderer({ canvas: els.designCanvas, antialias: true, preserveDrawingBuffer: true });
  designRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  designRenderer.outputColorSpace = THREE.SRGBColorSpace;

  designScene.add(new THREE.HemisphereLight("#fff8ef", "#091011", 2.2));
  const key = new THREE.DirectionalLight("#ffffff", 2.7);
  key.position.set(130, 170, 120);
  designScene.add(key);
  const warm = new THREE.DirectionalLight("#ff9c4a", 0.82);
  warm.position.set(-130, 45, -90);
  designScene.add(warm);
  designModelGroup = new THREE.Group();
  designModelGroup.rotation.order = "YXZ";
  designScene.add(designModelGroup);
  resizeDesignScene();
}

function resizeDesignScene() {
  if (!designRenderer || !designCamera || !els.designCanvas) return;
  const rect = els.designCanvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  designCamera.aspect = width / height;
  designCamera.updateProjectionMatrix();
  designRenderer.setSize(width, height, false);
}

function updateDesignCamera() {
  if (!designCamera) return;
  designCamera.position.set(designCameraTarget.x, designCameraTarget.y + designCameraDistance * 0.26, designCameraTarget.z + designCameraDistance);
  designCamera.lookAt(designCameraTarget);
  designCamera.zoom = 1 / designZoomScale;
  designCamera.near = Math.max(0.1, designCameraDistance / 100);
  designCamera.far = designCameraDistance * 9;
  designCamera.updateProjectionMatrix();
}

function fitDesignCamera() {
  if (!designModelGroup || !designCamera) return;
  const box = new THREE.Box3().setFromObject(designModelGroup);
  if (box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  designCameraDistance = Math.max(92, sphere.radius * 2.12);
  designCameraTarget.copy(sphere.center);
  updateDesignCamera();
}

function renderDesignPreview(options = {}) {
  if (!designModelGroup) return;
  const { fitView = false } = options;
  const p = designGeometryParams();
  const style = normalizeDesignStyle(state.designDraft.style);
  designModelGroup.clear();
  designModelGroup.rotation.set(designViewerRotation.x, designViewerRotation.y, designViewerRotation.z);
  const frameMaterial = new THREE.MeshStandardMaterial({ color: style.frameColor, roughness: 0.37, metalness: 0.035 });
  const detailMaterial = new THREE.MeshStandardMaterial({ color: style.detailColor, roughness: 0.42, metalness: 0.02 });
  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: style.lensColor,
    transparent: true,
    opacity: 0.62,
    roughness: 0.16,
    metalness: 0.04,
    transmission: 0.24
  });
  const outerLensWidth = (p.head_width - p.bridge_width) / 2;
  const center = p.bridge_width / 2 + outerLensWidth / 2;
  [-1, 1].forEach((side) => {
    addDesignRim(side * center, p, outerLensWidth, frameMaterial, style);
    addDesignLens(side * center, p, lensMaterial, style);
    addDesignTemple(side, p, outerLensWidth, frameMaterial, detailMaterial, style);
  });
  if (style.browBar) addDesignBar(p.head_width, p.lens_height / 2 + p.rim_thickness * 0.72, p.rim_thickness * 1.05, p.frame_depth * 0.95, frameMaterial, p);
  addDesignBar(p.bridge_width + p.rim_thickness * 2.35, p.lens_height * 0.08, p.rim_thickness * 1.15, p.frame_depth, frameMaterial, p);
  [-1, 1].forEach((side) => {
    const geometry = roundedPrismGeometry(p.nose_pad_width, p.rim_thickness * 1.45, p.frame_depth * 0.72, p.rim_thickness * 0.35, p.bevel * 0.45);
    const pad = new THREE.Mesh(geometry, frameMaterial);
    pad.position.set(side * (p.bridge_width / 2 + p.nose_pad_width / 2), -p.lens_height / 4 - p.nose_pad_drop / 4, -p.frame_depth * 0.35);
    pad.rotation.z = side * THREE.MathUtils.degToRad(10);
    designModelGroup.add(pad);
  });
  const centerPoint = new THREE.Box3().setFromObject(designModelGroup).getCenter(new THREE.Vector3());
  designModelGroup.children.forEach((child) => child.position.sub(centerPoint));
  if (fitView) {
    designZoomScale = 1;
    fitDesignCamera();
  }
  if (els.designDimensions) {
    els.designDimensions.textContent = `${formatNumber(p.head_width)} mm frame / ${formatNumber(p.bridge_width)} mm bridge / ${formatNumber(p.temple_length)} mm temple`;
  }
}

function designCornerRadius(p, style, outer = false) {
  if (style.lensShape === "round") return Math.min(p.lens_height / 2, p.lens_width / 2) + (outer ? p.rim_thickness : 0);
  if (style.lensShape === "sharp") return Math.max(2, p.corner_radius * 0.44 + (outer ? p.rim_thickness * 0.35 : 0));
  return p.corner_radius + (outer ? p.rim_thickness * 0.9 : 0);
}

function addDesignRim(x, p, outerWidth, material, style, target = designModelGroup) {
  const outer = roundedRectShape(outerWidth, p.lens_height + p.rim_thickness * 2.05, designCornerRadius(p, style, true));
  outer.holes.push(roundedRectShape(p.lens_width, p.lens_height, designCornerRadius(p, style)));
  const geometry = new THREE.ExtrudeGeometry(outer, {
    depth: p.frame_depth,
    bevelEnabled: p.bevel > 0,
    bevelThickness: Math.max(0.01, p.bevel),
    bevelSize: Math.max(0.01, p.bevel),
    bevelSegments: p.bevel > 0 ? 2 : 0
  });
  geometry.center();
  const rim = new THREE.Mesh(geometry, material);
  rim.position.x = x;
  target.add(rim);
}

function addDesignLens(x, p, material, style, target = designModelGroup) {
  const shape = roundedRectShape(p.lens_width - 0.4, p.lens_height - 0.4, designCornerRadius(p, style));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.8, p.frame_depth * 0.36), bevelEnabled: false });
  geometry.center();
  const lens = new THREE.Mesh(geometry, material);
  lens.position.set(x, 0, p.frame_depth * 0.18);
  target.add(lens);
}

function addDesignBar(width, y, height, depth, material, p, target = designModelGroup) {
  const geometry = roundedPrismGeometry(width, height, depth, height * 0.42, p.bevel * 0.7);
  const bar = new THREE.Mesh(geometry, material);
  bar.position.set(0, y, 0.05);
  target.add(bar);
}

function addDesignTemple(side, p, outerLensWidth, frameMaterial, detailMaterial, style, target = designModelGroup) {
  const hingeX = side * (p.head_width / 2 + p.hinge_width / 2);
  const temple = new THREE.Group();
  temple.position.set(hingeX, p.lens_height * 0.27, -p.frame_depth * 0.05);
  temple.rotation.y = side * THREE.MathUtils.degToRad(p.temple_spread);
  const hinge = new THREE.Mesh(roundedPrismGeometry(p.hinge_width, p.rim_thickness * 1.7, p.frame_depth * 1.2, p.rim_thickness * 0.32, p.bevel * 0.55), frameMaterial);
  temple.add(hinge);
  const armWidth = p.rim_thickness * 1.28;
  const arm = new THREE.Mesh(roundedPrismGeometry(armWidth, p.rim_thickness * 1.08, p.temple_length, p.rim_thickness * 0.32, p.bevel * 0.5), frameMaterial);
  arm.position.set(side * p.hinge_width * 0.34, 0, -p.temple_length / 2 - p.frame_depth * 0.5);
  temple.add(arm);
  const hook = new THREE.Mesh(roundedPrismGeometry(armWidth * 1.04, p.rim_thickness * 1.08, Math.max(1, p.temple_drop), p.rim_thickness * 0.32, p.bevel * 0.5), frameMaterial);
  hook.position.set(side * p.hinge_width * 0.34, -p.temple_drop * 0.28, -p.temple_length - p.frame_depth * 0.5 - p.temple_drop * 0.28);
  hook.rotation.x = THREE.MathUtils.degToRad(-28);
  temple.add(hook);
  if (style.templePattern === "ribs") {
    for (let index = 0; index < 5; index += 1) {
      const rib = new THREE.Mesh(roundedPrismGeometry(armWidth * 1.16, p.rim_thickness * 1.13, 1.4, 0.35, 0.08), detailMaterial);
      rib.position.set(side * p.hinge_width * 0.34, 0, -26 - index * 9);
      temple.add(rib);
    }
  }
  if (style.templePattern === "perforated") {
    for (let index = 0; index < 5; index += 1) {
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.34, 18), detailMaterial);
      dot.rotation.x = Math.PI / 2;
      dot.position.set(side * p.hinge_width * 0.34, p.rim_thickness * 0.56, -25 - index * 11);
      temple.add(dot);
    }
  }
  if (style.templeText) addDesignTextMark(style.templeText, side, p, temple, detailMaterial);
  target.add(temple);
}

function addDesignTextMark(text, side, p, temple, material) {
  const width = THREE.MathUtils.clamp(text.length * 2.7, 12, 42);
  const plate = new THREE.Mesh(roundedPrismGeometry(p.rim_thickness * 1.34, p.rim_thickness * 1.12, width, 0.36, 0.08), material);
  plate.position.set(side * p.hinge_width * 0.34, p.rim_thickness * 0.08, -58);
  temple.add(plate);
}

function bindUi() {
  els.controls.addEventListener("input", (event) => {
    const input = event.target;
    if (!input.dataset.param) return;
    state.params[input.dataset.param] = Number(input.value);
    document.querySelector(`#${input.dataset.param}Output`).value = formatValue(input.value, findParam(input.dataset.param)?.[6] || "");
    state.previewMode = "parametric";
    updateGeneratedSource();
    render({ fitView: false });
    syncActiveModel({ persist: false });
    scheduleModelPersist();
  });

  els.builderControls.addEventListener("change", (event) => {
    const select = event.target.closest("[data-component-model]");
    if (!select) return;
    state.assembly[select.dataset.componentModel].modelId = select.value;
    applyAssemblyToParams();
    buildBuilderControls();
    buildControls();
    updateGeneratedSource();
    render({ fitView: false });
    syncActiveModel({ persist: false });
    scheduleModelPersist();
  });

  els.builderControls.addEventListener("toggle", (event) => {
    const details = event.target.closest("details[data-component-options]");
    if (!details) return;
    state.openComponentOptions[details.dataset.componentOptions] = details.open;
  }, true);

  els.builderControls.addEventListener("click", (event) => {
    const editSlot = event.target.closest("[data-edit-color-slot]");
    if (editSlot) {
      const index = Number(editSlot.dataset.editColorSlot);
      openColorPickerEditor({
        type: "slot",
        index,
        color: state.colorSlots[index],
        title: `Color slot ${index + 1}`
      });
      return;
    }

    const colorSlot = event.target.closest("[data-apply-color-slot]");
    if (colorSlot) {
      const key = colorSlot.dataset.applyColorSlot;
      openColorPickerEditor({
        type: "component",
        key,
        color: colorSlot.dataset.color,
        source: "slot",
        title: `${colorSlot.dataset.componentLabel} color`
      });
      return;
    }

    const openColorEditor = event.target.closest("[data-open-component-color]");
    if (openColorEditor) {
      const key = openColorEditor.dataset.openComponentColor;
      openColorPickerEditor({
        type: "component",
        key,
        color: openColorEditor.dataset.currentColor,
        source: "custom",
        title: `${openColorEditor.dataset.componentLabel} color`
      });
      return;
    }

    const option = event.target.closest("[data-component-option]");
    if (option) {
      state.assembly[option.dataset.componentOption].modelId = option.dataset.modelId;
      applyAssemblyToParams();
      buildBuilderControls();
      buildControls();
      updateGeneratedSource();
      render({ fitView: false });
      syncActiveModel({ persist: false });
      scheduleModelPersist();
      return;
    }

    const button = event.target.closest("[data-assembly-size]");
    if (!button) return;
    setAssemblySize(button.dataset.assemblySize);
    applyAssemblyToParams();
    buildBuilderControls();
    buildControls();
    updateGeneratedSource();
    render({ fitView: false });
    syncActiveModel({ persist: false });
    scheduleModelPersist();
  });

  els.sunGalleryGrid.addEventListener("click", handleGalleryClick);
  els.opticalGalleryGrid?.addEventListener("click", handleGalleryClick);
  els.developerCollectionList?.addEventListener("click", handleDeveloperCollectionListClick);
  els.designSubmissionList?.addEventListener("click", handleDesignSubmissionReviewClick);
  els.componentFileList.addEventListener("click", handleComponentFileListClick);
  els.frameEditorComponentGallery?.addEventListener("click", handleComponentFileListClick);
  els.addCollection.addEventListener("click", addCollectionFromStudio);
  els.collectionImageInput.addEventListener("change", handleCollectionImageSelect);
  els.componentFileInput.addEventListener("change", handleComponentFileSelect);
  els.componentKind.addEventListener("change", syncComponentSideInput);
  els.accountButton.addEventListener("click", () => {
    els.accountPanel.hidden = false;
    updateAccountUi();
    if (state.account.role === "visitor") els.accountEmail.focus();
  });
  els.plansButton.addEventListener("click", () => {
    openPlansPanel();
  });
  els.closeAccountPanel.addEventListener("click", () => {
    els.accountPanel.hidden = true;
  });
  els.closeProfilePanel.addEventListener("click", () => {
    els.accountPanel.hidden = true;
  });
  els.closePlansPanel.addEventListener("click", () => {
    els.plansPanel.hidden = true;
  });
  els.authModeButtons.forEach((button) => {
    button.addEventListener("click", () => setAuthMode(button.dataset.authMode === "register" ? "register" : "login"));
  });
  els.passwordToggleButtons.forEach((button) => {
    button.addEventListener("click", () => togglePasswordVisibility(button));
  });
  els.signInAccount.addEventListener("click", () => signInAccount());
  els.accountPanel.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (event.target === els.licenseCodeInput) {
      event.preventDefault();
      redeemLicenseCode();
      return;
    }
    if (state.account.role !== "visitor") return;
    event.preventDefault();
    signInAccount();
  });
  els.licenseCodeInput.addEventListener("input", () => {
    els.licenseCodeInput.value = formatLicenseCode(els.licenseCodeInput.value);
  });
  els.redeemLicenseCode.addEventListener("click", () => redeemLicenseCode());
  els.signOutAccount.addEventListener("click", () => signOutAccount());
  els.profileSignOut.addEventListener("click", () => signOutAccount());
  els.cancelSubscription.addEventListener("click", () => cancelSubscription());
  els.saveFitProfile?.addEventListener("click", () => saveFitProfile());
  els.googleLogin.addEventListener("click", () => startOauth("google"));
  els.profileOpenPlans.addEventListener("click", () => {
    els.accountPanel.hidden = true;
    openPlansPanel();
  });
  els.planButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.account.plan = button.dataset.plan;
      updateAccountUi();
    });
  });
  els.planPickButtons.forEach((button) => {
    button.addEventListener("click", () => {
      openLicenseActivation(button.dataset.planPick);
    });
  });
  els.pricingGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-plan-pick]");
    if (button) openLicenseActivation(button.dataset.planPick);
  });
  [els.cropZoom, els.cropX, els.cropY].forEach((input) => input.addEventListener("input", drawImageCrop));
  els.applyCrop.addEventListener("click", applyImageCrop);
  els.cancelCrop.addEventListener("click", cancelImageCrop);
  els.openHome.addEventListener("click", (event) => {
    event.preventDefault();
    goHome();
  });
  els.brandHome?.addEventListener("click", goHome);
  els.openConfigurator.addEventListener("click", () => navigateToView("configurator"));
  els.openGallery.addEventListener("click", (event) => {
    event.preventDefault();
    syncActiveModel();
    renderGallery();
    scrollGalleryIntoView();
  });
  [
    [els.openSizes, "#sizeGuidePanel"],
    [els.openPrintGuide, "#printGuidePanel"],
    [els.openRoadmap, "#roadmapPanel"],
    [els.openLicenseInfo, "#licenseInfoPanel"],
    [els.openFaq, "#faqPanel"]
  ].forEach(([link, target]) => {
    link?.addEventListener("click", (event) => {
      event.preventDefault();
      scrollHomeSection(target);
    });
  });
  els.openStudio.addEventListener("click", (event) => {
    event.preventDefault();
    navigateToView("developer");
  });
  els.clearStudioEdit?.addEventListener("click", () => {
    clearCollectionForm();
    navigateToView("collection-editor");
  });
  els.backToDeveloper?.addEventListener("click", () => {
    navigateToView("developer");
  });
  els.newDeveloperCollection?.addEventListener("click", () => {
    clearCollectionForm();
    navigateToView("collection-editor");
  });
  els.openLicenses.addEventListener("click", async (event) => {
    event.preventDefault();
    navigateToView("licenses");
    await Promise.all([loadStaticLicenseCodes(), loadLicenseCodes()]);
  });
  els.brandAccentColor?.addEventListener("input", () => {
    setBrandColor("accentColor", els.brandAccentColor.value, { previewOnly: true });
  });
  els.brandAccentText?.addEventListener("input", () => {
    setBrandColor("accentColor", els.brandAccentText.value, { previewOnly: true });
  });
  [
    ["backgroundColor", els.brandBackgroundColor],
    ["surfaceColor", els.brandSurfaceColor],
    ["textColor", els.brandTextColor],
    ["mutedColor", els.brandMutedColor],
    ["borderColor", els.brandBorderColor],
    ["sceneColor", els.brandSceneColor]
  ].forEach(([key, input]) => {
    input?.addEventListener("input", () => setBrandColor(key, input.value, { previewOnly: true }));
  });
  els.heroTitleInput?.addEventListener("input", () => {
    state.brandSettings.heroTitle = els.heroTitleInput.value;
    applyBrandSettings();
    if (els.brandSettingsNote) els.brandSettingsNote.textContent = "Previewing hero text. Save to publish it.";
  });
  els.heroTextInput?.addEventListener("input", () => {
    state.brandSettings.heroText = els.heroTextInput.value;
    applyBrandSettings();
    if (els.brandSettingsNote) els.brandSettingsNote.textContent = "Previewing hero text. Save to publish it.";
  });
  els.heroEditorTarget?.addEventListener("change", () => {
    state.brandSettings.heroModelId = els.heroEditorTarget.value;
    applyBrandSettings();
    if (els.brandSettingsNote) els.brandSettingsNote.textContent = "Previewing hero editor target. Save to publish it.";
  });
  els.heroImageInput?.addEventListener("change", handleHeroImageSelect);
  els.resetHeroImage?.addEventListener("click", () => {
    state.brandSettings.heroImage = "";
    applyBrandSettings();
    if (els.heroImageInput) els.heroImageInput.value = "";
    if (els.brandSettingsNote) els.brandSettingsNote.textContent = "Default hero image selected. Save to publish it.";
  });
  els.pageContentEditor?.addEventListener("change", (event) => {
    const imageInput = event.target.closest("[data-print-guide-image]");
    if (imageInput) handlePrintGuideImageSelect(imageInput.files?.[0]);
  });
  els.pageContentEditor?.addEventListener("click", (event) => {
    if (!event.target.closest("[data-clear-print-guide-image]")) return;
    state.brandSettings.content = normalizeContentSettings({
      ...state.brandSettings.content,
      printGuide: {
        ...state.brandSettings.content.printGuide,
        image: ""
      }
    });
    applyBrandSettings();
    if (els.brandSettingsNote) els.brandSettingsNote.textContent = "Print guide image cleared. Save to publish it.";
  });
  els.saveBrandSettings?.addEventListener("click", () => saveBrandSettings());
  els.resetBrandSettings?.addEventListener("click", () => resetBrandSettings());
  els.refreshStorageDebug?.addEventListener("click", () => loadStorageDebug());
  els.generateLicenseCodes.addEventListener("click", () => generateLicenseCodes());
  els.heroBrowse.addEventListener("click", scrollGalleryIntoView);
  els.heroEditor.addEventListener("click", openHeroEditorTarget);
  els.openDesignLab?.addEventListener("click", (event) => {
    event.preventDefault();
    navigateToView("design-lab");
  });
  els.startDesignLab?.addEventListener("click", () => navigateToView("design-lab"));
  els.exitDesignLab?.addEventListener("click", scrollGalleryIntoView);
  els.designTabs.forEach((button) => button.addEventListener("click", () => switchDesignTab(button.dataset.designTab)));
  els.designOperationsPanel?.addEventListener("input", handleDesignOperationChange);
  els.designOperationsPanel?.addEventListener("change", handleDesignOperationChange);
  els.designName?.addEventListener("input", handleDesignProjectCopyChange);
  els.designDescription?.addEventListener("input", handleDesignProjectCopyChange);
  els.regenerateDesignCode?.addEventListener("click", () => {
    state.designDraft.manualCode = false;
    syncDesignCode();
    setDesignNote("OpenSCAD code regenerated from operations.");
  });
  els.applyDesignCode?.addEventListener("click", applyDesignCode);
  els.resetDesign?.addEventListener("click", resetDesignDraft);
  els.downloadDesignScad?.addEventListener("click", exportDesignScad);
  els.submitDesign?.addEventListener("click", submitDesignForReview);
  els.printGuideButton?.addEventListener("click", () => scrollHomeSection("#printGuidePanel"));
  els.openPrintGuideImage?.addEventListener("click", openPrintGuideLightbox);
  els.closeImageLightbox?.addEventListener("click", closePrintGuideLightbox);
  els.imageLightbox?.addEventListener("click", (event) => {
    if (event.target === els.imageLightbox) closePrintGuideLightbox();
  });
  els.colorPickerInput?.addEventListener("input", updateColorPickerDraft);
  els.closeColorPicker?.addEventListener("click", closeColorPickerEditor);
  els.cancelColorPicker?.addEventListener("click", closeColorPickerEditor);
  els.applyColorPicker?.addEventListener("click", applyColorPickerEditor);
  els.colorPickerPanel?.addEventListener("click", (event) => {
    if (event.target === els.colorPickerPanel) closeColorPickerEditor();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.imageLightbox && !els.imageLightbox.hidden) closePrintGuideLightbox();
    if (event.key === "Escape" && els.colorPickerPanel && !els.colorPickerPanel.hidden) closeColorPickerEditor();
  });
  els.saveCurrentModel.addEventListener("click", saveCurrentModel);
  els.resetParams.addEventListener("click", resetParams);
  els.exportScad.addEventListener("click", exportScad);
  els.exportJson.addEventListener("click", exportJson);
  els.copyScad.addEventListener("click", copyScad);
  els.generate3mf.addEventListener("click", generate3mf);
  els.generateStl.addEventListener("click", generateStl);
  els.downloadAssembly.addEventListener("click", downloadAssemblyPackage);
  els.addComponentFile.addEventListener("click", addComponentFile);
  els.saveEndpoint.addEventListener("click", saveEndpoint);
  els.viewFront?.addEventListener("click", () => setView("front"));
  els.viewIso?.addEventListener("click", () => setView("iso"));
  els.viewSide?.addEventListener("click", () => setView("side"));

  els.canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const rect = els.canvas.getBoundingClientRect();
    dragState = {
      mode: event.shiftKey || event.button === 1 || event.button === 2 ? "pan" : "rotate",
      x: event.clientX,
      y: event.clientY,
      rx: state.viewerRotation.x,
      ry: state.viewerRotation.y,
      px: state.viewerPan.x,
      py: state.viewerPan.y,
      rotateSpeed: Math.PI / Math.max(420, Math.min(rect.width, rect.height)),
      panSpeed: viewerPanSpeed(rect.height)
    };
    els.canvas.classList.add(dragState.mode === "pan" ? "is-panning" : "is-rotating");
    els.canvas.setPointerCapture(event.pointerId);
  });
  els.canvas.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    event.preventDefault();
    const dx = event.clientX - dragState.x;
    const dy = event.clientY - dragState.y;
    if (dragState.mode === "pan") {
      state.viewerPan.x = dragState.px + dx * dragState.panSpeed;
      state.viewerPan.y = dragState.py - dy * dragState.panSpeed;
    } else {
      state.viewerRotation.y = normalizeOrbitAngle(dragState.ry + dx * dragState.rotateSpeed);
      state.viewerRotation.x = normalizeOrbitAngle(dragState.rx + dy * dragState.rotateSpeed * 0.82);
    }
    applyViewerTransform();
  });
  els.canvas.addEventListener("pointerup", () => {
    dragState = null;
    els.canvas.classList.remove("is-rotating", "is-panning");
  });
  els.canvas.addEventListener("pointercancel", () => {
    dragState = null;
    els.canvas.classList.remove("is-rotating", "is-panning");
  });
  els.canvas.addEventListener("dblclick", resetViewerPose);
  els.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  els.canvas.addEventListener("wheel", handleCanvasWheel, { passive: false });
  els.designCanvas?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const rect = els.designCanvas.getBoundingClientRect();
    designDragState = {
      mode: event.shiftKey || event.button === 1 || event.button === 2 ? "pan" : "rotate",
      x: event.clientX,
      y: event.clientY,
      rx: designViewerRotation.x,
      ry: designViewerRotation.y,
      tx: designCameraTarget.x,
      ty: designCameraTarget.y,
      rotateSpeed: Math.PI / Math.max(420, Math.min(rect.width, rect.height)),
      panSpeed: Math.max(0.04, designCameraDistance / Math.max(520, rect.height) * designZoomScale)
    };
    els.designCanvas.classList.add(designDragState.mode === "pan" ? "is-panning" : "is-rotating");
    els.designCanvas.setPointerCapture(event.pointerId);
  });
  els.designCanvas?.addEventListener("pointermove", (event) => {
    if (!designDragState) return;
    event.preventDefault();
    const dx = event.clientX - designDragState.x;
    const dy = event.clientY - designDragState.y;
    if (designDragState.mode === "pan") {
      designCameraTarget.x = designDragState.tx - dx * designDragState.panSpeed;
      designCameraTarget.y = designDragState.ty + dy * designDragState.panSpeed;
      updateDesignCamera();
      return;
    }
    designViewerRotation.y = normalizeOrbitAngle(designDragState.ry + dx * designDragState.rotateSpeed);
    designViewerRotation.x = normalizeOrbitAngle(designDragState.rx + dy * designDragState.rotateSpeed * 0.82);
    designModelGroup.rotation.set(designViewerRotation.x, designViewerRotation.y, designViewerRotation.z);
  });
  const finishDesignDrag = () => {
    designDragState = null;
    els.designCanvas?.classList.remove("is-rotating", "is-panning");
  };
  els.designCanvas?.addEventListener("pointerup", finishDesignDrag);
  els.designCanvas?.addEventListener("pointercancel", finishDesignDrag);
  els.designCanvas?.addEventListener("contextmenu", (event) => event.preventDefault());
  els.designCanvas?.addEventListener("wheel", (event) => {
    event.preventDefault();
    const direction = Math.exp(THREE.MathUtils.clamp(event.deltaY, -220, 220) * 0.0015);
    designZoomScale = THREE.MathUtils.clamp(designZoomScale * direction, 0.34, 3.5);
    updateDesignCamera();
  }, { passive: false });
  els.designCanvas?.addEventListener("dblclick", () => {
    designViewerRotation.x = -0.54;
    designViewerRotation.y = 0.56;
    designViewerRotation.z = 0.02;
    designZoomScale = 1;
    renderDesignPreview({ fitView: true });
  });
}

function t(key) {
  if (Object.prototype.hasOwnProperty.call(translations[state.lang] || {}, key)) {
    return translations[state.lang][key];
  }
  return key;
}

function getParameterText(key, fallbackLabel, fallbackHint) {
  return {
    label: t(`param_${key}_label`) || fallbackLabel,
    hint: t(`param_${key}_hint`) || fallbackHint
  };
}

function buildDesignControls() {
  const renderGroup = (entries) => entries.map(([key, label]) => {
    const [, , , min, max, step, unit] = findParam(key);
    const value = state.designDraft.params[key];
    return `
      <div class="design-control">
        <label for="design-${escapeHtml(key)}">${escapeHtml(label)}</label>
        <input id="design-${escapeHtml(key)}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-design-param="${escapeHtml(key)}" />
        <output id="design-${escapeHtml(key)}-output">${escapeHtml(formatValue(value, unit))}</output>
      </div>
    `;
  }).join("");
  if (els.designFrontControls) els.designFrontControls.innerHTML = renderGroup(designParameterGroups.front);
  if (els.designTempleControls) els.designTempleControls.innerHTML = renderGroup(designParameterGroups.temples);
  syncDesignFields();
  syncDesignCode();
}

function syncDesignFields() {
  const draft = state.designDraft;
  if (els.designName) els.designName.value = draft.name;
  if (els.designDescription) els.designDescription.value = draft.description;
  [...designParameterGroups.front, ...designParameterGroups.temples].forEach(([key]) => {
    const input = document.querySelector(`[data-design-param="${key}"]`);
    const output = document.querySelector(`#design-${key}-output`);
    const unit = findParam(key)?.[6] || "";
    if (input) input.value = String(draft.params[key]);
    if (output) output.textContent = formatValue(draft.params[key], unit);
  });
  const style = normalizeDesignStyle(draft.style);
  if (els.designLensShape) els.designLensShape.value = style.lensShape;
  if (els.designTemplePattern) els.designTemplePattern.value = style.templePattern;
  if (els.designTempleText) els.designTempleText.value = style.templeText;
  if (els.designBrowBar) els.designBrowBar.checked = style.browBar;
  if (els.designFrameColor) els.designFrameColor.value = style.frameColor;
  if (els.designLensColor) els.designLensColor.value = style.lensColor;
  if (els.designDetailColor) els.designDetailColor.value = style.detailColor;
}

function syncDesignCode() {
  state.designDraft.style = normalizeDesignStyle(state.designDraft.style);
  state.designDraft.code = buildDesignScad(state.designDraft);
  if (els.designScadCode) els.designScadCode.value = state.designDraft.code;
}

function switchDesignTab(mode) {
  const code = mode === "code";
  els.designTabs.forEach((button) => {
    const active = button.dataset.designTab === (code ? "code" : "operations");
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (els.designOperationsPanel) els.designOperationsPanel.hidden = code;
  if (els.designCodePanel) els.designCodePanel.hidden = !code;
}

function handleDesignProjectCopyChange() {
  state.designDraft.name = cleanText(els.designName?.value, "My custom frame", 120);
  state.designDraft.description = cleanText(els.designDescription?.value, "", 260);
}

function handleDesignOperationChange(event) {
  const param = event.target.dataset.designParam;
  if (param) {
    state.designDraft.params[param] = Number(event.target.value);
    const unit = findParam(param)?.[6] || "";
    const output = document.querySelector(`#design-${param}-output`);
    if (output) output.textContent = formatValue(event.target.value, unit);
  }
  state.designDraft.style = normalizeDesignStyle({
    ...state.designDraft.style,
    lensShape: els.designLensShape?.value,
    templePattern: els.designTemplePattern?.value,
    templeText: els.designTempleText?.value,
    browBar: Boolean(els.designBrowBar?.checked),
    frameColor: els.designFrameColor?.value,
    lensColor: els.designLensColor?.value,
    detailColor: els.designDetailColor?.value
  });
  state.designDraft.manualCode = false;
  syncDesignCode();
  renderDesignPreview({ fitView: false });
  setDesignNote("");
}

function parseDesignCode(source) {
  const style = { ...state.designDraft.style };
  const textValue = source.match(/(?:^|\n)\s*temple_text\s*=\s*"([^"]*)"\s*;/)?.[1];
  const patternValue = source.match(/(?:^|\n)\s*temple_pattern\s*=\s*"([^"]*)"\s*;/)?.[1];
  const shapeValue = source.match(/(?:^|\n)\s*lens_shape\s*=\s*"([^"]*)"\s*;/)?.[1];
  const browValue = source.match(/(?:^|\n)\s*brow_bar_enabled\s*=\s*(true|false)\s*;/)?.[1];
  const colorValues = {
    frameColor: source.match(/(?:^|\n)\s*frame_color\s*=\s*"(#[0-9a-fA-F]{6})"\s*;/)?.[1],
    lensColor: source.match(/(?:^|\n)\s*lens_color\s*=\s*"(#[0-9a-fA-F]{6})"\s*;/)?.[1],
    detailColor: source.match(/(?:^|\n)\s*detail_color\s*=\s*"(#[0-9a-fA-F]{6})"\s*;/)?.[1]
  };
  return {
    params: { ...state.designDraft.params, ...parseScadParameters(source) },
    style: normalizeDesignStyle({
      ...style,
      templeText: textValue === undefined ? style.templeText : textValue,
      templePattern: patternValue || style.templePattern,
      lensShape: shapeValue || style.lensShape,
      browBar: browValue === undefined ? style.browBar : browValue === "true",
      ...colorValues
    })
  };
}

function applyDesignCode() {
  const source = String(els.designScadCode?.value || "").trim();
  if (!source) {
    setDesignNote("Enter OpenSCAD code before applying.");
    return;
  }
  const parsed = parseDesignCode(source);
  state.designDraft.params = parsed.params;
  state.designDraft.style = parsed.style;
  state.designDraft.code = source;
  state.designDraft.manualCode = true;
  syncDesignFields();
  renderDesignPreview({ fitView: false });
  setDesignNote("Supported OpenSCAD parameters applied to the preview. Custom code is kept in the submitted file.");
}

function resetDesignDraft() {
  state.designDraft = createDefaultDesignDraft();
  buildDesignControls();
  switchDesignTab("operations");
  renderDesignPreview({ fitView: true });
  setDesignNote("New design ready.");
}

function exportDesignScad() {
  handleDesignProjectCopyChange();
  const source = state.designDraft.manualCode ? els.designScadCode.value : buildDesignScad(state.designDraft);
  downloadText(`${slugify(state.designDraft.name)}.scad`, source, "application/scad");
  setDesignNote("OpenSCAD project downloaded.");
}

function setDesignNote(message) {
  if (els.designStatus) els.designStatus.textContent = message;
}

function captureDesignThumbnail() {
  if (!designRenderer || !designScene || !designCamera) return "";
  try {
    designRenderer.render(designScene, designCamera);
    return designRenderer.domElement.toDataURL("image/jpeg", 0.82);
  } catch {
    return "";
  }
}

async function submitDesignForReview() {
  handleDesignProjectCopyChange();
  if (state.account.role === "visitor" || !sessionToken()) {
    els.accountPanel.hidden = false;
    setDesignNote("Sign in to submit your custom frame for gallery review.");
    return;
  }
  const source = state.designDraft.manualCode ? String(els.designScadCode?.value || "") : buildDesignScad(state.designDraft);
  if (!source.trim()) {
    setDesignNote("OpenSCAD source is required before submission.");
    return;
  }
  els.submitDesign.disabled = true;
  setDesignNote("Submitting your design for review...");
  try {
    const payload = await apiRequest("/api/design-submissions", {
      method: "POST",
      body: JSON.stringify({
        name: state.designDraft.name,
        description: state.designDraft.description,
        params: state.designDraft.params,
        design: state.designDraft.style,
        scadSource: source,
        thumbnail: captureDesignThumbnail()
      })
    });
    setDesignNote(`${payload.submission.name} was sent for review.`);
    await loadMyDesignSubmissions();
    if (isDeveloper()) await loadDesignSubmissions();
  } catch (error) {
    setDesignNote(error.message || "Could not submit this design.");
  } finally {
    els.submitDesign.disabled = false;
  }
}

async function loadMyDesignSubmissions() {
  if (!els.designSubmissionStatus) return;
  if (state.account.role === "visitor" || !sessionToken()) {
    els.designSubmissionStatus.innerHTML = "";
    return;
  }
  try {
    const payload = await apiRequest("/api/design-submissions/mine");
    const submissions = Array.isArray(payload.submissions) ? payload.submissions : [];
    els.designSubmissionStatus.innerHTML = submissions.slice(0, 3).map((submission) => {
      const label = submission.status === "approved" ? "Approved" : submission.status === "rejected" ? "Not approved" : "In review";
      return `<div class="design-own-submission status-${escapeHtml(submission.status)}"><strong>${escapeHtml(submission.name)}</strong><span>${label}</span></div>`;
    }).join("");
  } catch {
    els.designSubmissionStatus.innerHTML = "";
  }
}

async function loadDesignSubmissions() {
  if (!isDeveloper() || !sessionToken() || !els.designSubmissionList) return;
  try {
    const payload = await apiRequest("/api/admin/design-submissions");
    state.designSubmissions = Array.isArray(payload.submissions) ? payload.submissions : [];
    renderDesignSubmissions();
  } catch (error) {
    els.designSubmissionList.innerHTML = `<p class="account-note">${escapeHtml(error.message || "Could not load submissions.")}</p>`;
  }
}

function renderDesignSubmissions() {
  if (!els.designSubmissionList) return;
  if (!state.designSubmissions.length) {
    els.designSubmissionList.innerHTML = `<p class="account-note">No submitted custom designs yet.</p>`;
    return;
  }
  els.designSubmissionList.innerHTML = state.designSubmissions.map((submission) => {
    const dimensions = `${formatNumber(Number(submission.params?.head_width || 0))} mm width / ${formatNumber(Number(submission.params?.bridge_width || 0))} mm bridge`;
    const status = submission.status === "approved" ? "Approved" : submission.status === "rejected" ? "Rejected" : "Pending review";
    const image = submission.thumbnail
      ? `<img class="submission-thumb" src="${submission.thumbnail}" alt="Preview of ${escapeHtml(submission.name)}" />`
      : `<div class="submission-thumb submission-thumb-empty" aria-hidden="true"></div>`;
    const actions = submission.status === "pending"
      ? `<button type="button" class="accent" data-submission-action="approve" data-submission-id="${escapeHtml(submission.id)}">Approve</button>
         <button type="button" class="delete-button" data-submission-action="reject" data-submission-id="${escapeHtml(submission.id)}">Reject</button>`
      : "";
    return `
      <article class="submission-row status-${escapeHtml(submission.status)}">
        ${image}
        <div class="submission-copy">
          <strong>${escapeHtml(submission.name)}</strong>
          <small>${escapeHtml(submission.authorName || submission.authorEmail || "Customer")} · ${escapeHtml(dimensions)}</small>
          <span class="submission-status">${escapeHtml(status)}</span>
        </div>
        <div class="submission-actions">${actions}</div>
      </article>
    `;
  }).join("");
}

async function handleDesignSubmissionReviewClick(event) {
  const button = event.target.closest("button[data-submission-action]");
  if (!button || !isDeveloper()) return;
  const action = button.dataset.submissionAction;
  const id = button.dataset.submissionId;
  button.disabled = true;
  try {
    const payload = await apiRequest(`/api/admin/design-submissions/${encodeURIComponent(id)}/${action}`, { method: "POST" });
    if (action === "approve") {
      state.models = await loadStoredModels();
      renderGallery();
      log(`Published Design Lab project: ${payload.submission.name}.`);
    } else {
      log(`Rejected Design Lab project: ${payload.submission.name}.`);
    }
    await loadDesignSubmissions();
    await loadStorageDebug({ silent: true });
  } catch (error) {
    log(error.message || "Could not review this submission.");
    button.disabled = false;
  }
}

function loadPublishedDesignIntoLab(model) {
  const storedCode = String(model.scadSource || "");
  state.designDraft = {
    name: model.name,
    description: model.description,
    params: { ...structuredClone(defaultParams), ...model.params },
    style: normalizeDesignStyle(model.design),
    code: storedCode,
    manualCode: Boolean(storedCode.trim())
  };
  buildDesignControls();
  if (state.designDraft.manualCode && els.designScadCode) {
    state.designDraft.code = storedCode;
    els.designScadCode.value = storedCode;
  }
  switchDesignTab("operations");
  navigateToView("design-lab");
  renderDesignPreview({ fitView: true });
  setDesignNote("Published design loaded. Changes can be submitted as a new review.");
}

function sceneBackgroundColor() {
  return state.brandSettings?.sceneColor || defaultBrandSettings.sceneColor;
}

function previewBackgroundColor() {
  return mixHex(state.brandSettings?.sceneColor || defaultBrandSettings.sceneColor, state.brandSettings?.surfaceColor || defaultBrandSettings.surfaceColor, 0.42);
}

function sanitizeHexColor(value, fallback = defaultAccentColor) {
  const match = String(value || "").trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? `#${match[1].toLowerCase()}` : fallback;
}

function sanitizeAccentColor(value, fallback = defaultAccentColor) {
  return sanitizeHexColor(value, fallback);
}

function normalizeColorSlots(slots) {
  const source = Array.isArray(slots) && slots.length ? slots : defaultColorSlots;
  return source
    .slice(0, 6)
    .map((color, index) => sanitizeHexColor(color, defaultColorSlots[index] || defaultAccentColor));
}

function cleanText(value, fallback = "", limit = 500) {
  const text = String(value ?? fallback).trim();
  return (text || fallback).slice(0, limit);
}

function sanitizeContentImage(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  const image = String(value || "").trim();
  if (!image) return "";
  if (image.startsWith("data:image/") || image.startsWith("./assets/")) return image;
  return fallback;
}

function cleanPrintGuideIntro(value, fallback) {
  const intro = cleanText(value, fallback, 500);
  return /^Use PETG, PA-CF or a tough PLA blend/i.test(intro) ? fallback : intro;
}

function normalizeFaqItem(item = {}, fallback = {}) {
  const question = cleanText(item.question, fallback.question || "Question", 120);
  const answer = cleanText(item.answer, fallback.answer || "", 360);
  const developerOnlyCopy = /developer tools|add new fronts|frame variants/i.test(`${question} ${answer}`);
  return developerOnlyCopy
    ? {
        question: fallback.question || defaultContentSettings.faq.items[2].question,
        answer: fallback.answer || defaultContentSettings.faq.items[2].answer
      }
    : { question, answer };
}

function normalizePlanContent(item = {}, fallback = {}) {
  const plan = ["basic", "pro", "studio"].includes(item.plan) ? item.plan : fallback.plan;
  return {
    plan,
    name: cleanText(item.name, fallback.name, 40),
    price: cleanText(item.price, fallback.price, 24),
    period: cleanText(item.period, fallback.period, 32),
    exports: cleanText(item.exports, fallback.exports, 90),
    description: cleanText(item.description, fallback.description, 180)
  };
}

function normalizeSizeRow(row = {}, fallback = {}) {
  const numberValue = (value, defaultValue, min = 0, max = 300) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return defaultValue;
    return Math.min(max, Math.max(min, Math.round(numeric)));
  };
  return {
    size: ["S", "M", "L"].includes(row.size) ? row.size : fallback.size,
    label: cleanText(row.label, fallback.label, 48),
    headMin: numberValue(row.headMin, fallback.headMin, 90, 220),
    headMax: numberValue(row.headMax, fallback.headMax, 90, 220),
    frameWidth: cleanText(row.frameWidth, fallback.frameWidth, 48),
    lensWidth: cleanText(row.lensWidth, fallback.lensWidth, 48),
    bridgeMin: numberValue(row.bridgeMin, fallback.bridgeMin, 8, 34),
    bridgeMax: numberValue(row.bridgeMax, fallback.bridgeMax, 8, 34),
    templeMin: numberValue(row.templeMin, fallback.templeMin, 100, 190),
    templeMax: numberValue(row.templeMax, fallback.templeMax, 100, 190),
    note: cleanText(row.note, fallback.note, 160)
  };
}

function normalizeContentSettings(content = {}) {
  const defaults = structuredClone(defaultContentSettings);
  const planById = new Map((Array.isArray(content.plans) ? content.plans : []).map((item) => [item.plan, item]));
  const sizeById = new Map((Array.isArray(content.sizes?.rows) ? content.sizes.rows : []).map((item) => [item.size, item]));
  return {
    plans: defaults.plans.map((fallback) => normalizePlanContent(planById.get(fallback.plan), fallback)),
    sizes: {
      heading: cleanText(content.sizes?.heading, defaults.sizes.heading, 80),
      intro: cleanText(content.sizes?.intro, defaults.sizes.intro, 320),
      rows: defaults.sizes.rows.map((fallback) => normalizeSizeRow(sizeById.get(fallback.size), fallback))
    },
    printGuide: {
      heading: cleanText(content.printGuide?.heading, defaults.printGuide.heading, 80),
      intro: cleanPrintGuideIntro(content.printGuide?.intro, defaults.printGuide.intro),
      image: sanitizeContentImage(content.printGuide?.image, defaults.printGuide.image)
    },
    roadmap: {
      heading: cleanText(content.roadmap?.heading, defaults.roadmap.heading, 80),
      items: (Array.isArray(content.roadmap?.items) ? content.roadmap.items : defaults.roadmap.items)
        .slice(0, 8)
        .map((item, index) => ({
          title: cleanText(item.title, defaults.roadmap.items[index]?.title || "Roadmap item", 90),
          status: cleanText(item.status, defaults.roadmap.items[index]?.status || "Planned", 40),
          description: cleanText(item.description, defaults.roadmap.items[index]?.description || "", 220)
        }))
    },
    license: {
      heading: cleanText(content.license?.heading, defaults.license.heading, 80),
      body: cleanText(content.license?.body, defaults.license.body, 800)
    },
    faq: {
      heading: cleanText(content.faq?.heading, defaults.faq.heading, 80),
      items: (Array.isArray(content.faq?.items) ? content.faq.items : defaults.faq.items)
        .slice(0, 10)
        .map((item, index) => normalizeFaqItem(item, defaults.faq.items[index] || defaults.faq.items[2]))
    }
  };
}

function normalizeBrandSettings(settings = {}) {
  const heroImage = typeof settings.heroImage === "string" && settings.heroImage.startsWith("data:image/")
    ? settings.heroImage
    : "";
  return {
    accentColor: sanitizeAccentColor(settings.accentColor),
    backgroundColor: sanitizeHexColor(settings.backgroundColor, defaultBrandSettings.backgroundColor),
    surfaceColor: sanitizeHexColor(settings.surfaceColor, defaultBrandSettings.surfaceColor),
    textColor: sanitizeHexColor(settings.textColor, defaultBrandSettings.textColor),
    mutedColor: sanitizeHexColor(settings.mutedColor, defaultBrandSettings.mutedColor),
    borderColor: sanitizeHexColor(settings.borderColor, defaultBrandSettings.borderColor),
    sceneColor: sanitizeHexColor(settings.sceneColor, defaultBrandSettings.sceneColor),
    heroTitle: String(settings.heroTitle || defaultBrandSettings.heroTitle).trim().slice(0, 120) || defaultBrandSettings.heroTitle,
    heroText: String(settings.heroText || defaultBrandSettings.heroText).trim().slice(0, 320) || defaultBrandSettings.heroText,
    heroImage,
    heroModelId: String(settings.heroModelId || "").trim().slice(0, 120),
    content: normalizeContentSettings(settings.content)
  };
}

function hexToRgb(hex) {
  const clean = sanitizeHexColor(hex, defaultAccentColor).slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function mixHex(hex, target = "#ffffff", amount = 0.24) {
  const base = hexToRgb(hex);
  const other = hexToRgb(target);
  const channel = (from, to) => Math.round(from + (to - from) * amount).toString(16).padStart(2, "0");
  return `#${channel(base.r, other.r)}${channel(base.g, other.g)}${channel(base.b, other.b)}`;
}

function rgbaFromHex(hex, alpha) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function colorLuminance(hex) {
  const rgb = hexToRgb(hex);
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function applyBrandSettings() {
  state.brandSettings = normalizeBrandSettings(state.brandSettings);
  const accent = state.brandSettings.accentColor;
  const background = state.brandSettings.backgroundColor;
  const surface = state.brandSettings.surfaceColor;
  const text = state.brandSettings.textColor;
  const muted = state.brandSettings.mutedColor;
  const border = state.brandSettings.borderColor;
  const sceneColor = state.brandSettings.sceneColor;
  const accent2 = mixHex(accent, "#ffffff", 0.22);
  const surface2 = mixHex(surface, text, 0.055);
  const lineStrong = mixHex(border, text, 0.18);
  const rgb = hexToRgb(accent);
  state.brandSettings.accentColor = accent;
  document.documentElement.style.setProperty("--bg", background);
  document.documentElement.style.setProperty("--surface", surface);
  document.documentElement.style.setProperty("--surface-2", surface2);
  document.documentElement.style.setProperty("--ink", text);
  document.documentElement.style.setProperty("--muted", muted);
  document.documentElement.style.setProperty("--line", border);
  document.documentElement.style.setProperty("--line-strong", lineStrong);
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-2", accent2);
  document.documentElement.style.setProperty("--accent-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`);
  document.documentElement.style.setProperty("--graphite", mixHex(surface, background, 0.38));
  document.documentElement.style.setProperty("--topbar-bg", rgbaFromHex(background, 0.94));
  document.documentElement.style.setProperty("--panel-bg", rgbaFromHex(surface, 0.92));
  document.documentElement.style.setProperty("--subtle-bg", rgbaFromHex(text, 0.035));
  document.documentElement.style.setProperty("--switch-bg", rgbaFromHex(text, 0.035));
  document.documentElement.style.setProperty("--preview-bg", mixHex(sceneColor, surface, 0.32));
  document.documentElement.style.setProperty("--log-bg", mixHex(background, surface, 0.26));
  document.documentElement.style.setProperty("--log-ink", text);
  document.documentElement.style.setProperty("--scene-bg-1", mixHex(sceneColor, surface, 0.2));
  document.documentElement.style.setProperty("--scene-bg-2", sceneColor);
  document.documentElement.style.setProperty("--loader-overlay-bg", rgbaFromHex(background, 0.72));
  document.documentElement.style.setProperty("--loader-track", rgbaFromHex(text, 0.08));
  document.documentElement.style.colorScheme = colorLuminance(background) > 0.55 ? "light" : "dark";
  if (scene) scene.background = new THREE.Color(sceneBackgroundColor());
	  if (renderer && scene && camera) render();
	  if (designScene) {
	    designScene.background = new THREE.Color(sceneBackgroundColor());
	    renderDesignPreview({ fitView: false });
	  }
	  localStorage.setItem(brandSettingsStorageKey, JSON.stringify(state.brandSettings));
	  syncBrandSettingsUi();
	  applyHeroSettings();
	  renderPlanCards();
	  renderMarketingContent();
	  renderFitRecommendation();
	}

function syncBrandSettingsUi() {
  if (els.brandAccentColor) els.brandAccentColor.value = state.brandSettings.accentColor;
  if (els.brandAccentText) els.brandAccentText.value = state.brandSettings.accentColor;
  if (els.brandBackgroundColor) els.brandBackgroundColor.value = state.brandSettings.backgroundColor;
  if (els.brandSurfaceColor) els.brandSurfaceColor.value = state.brandSettings.surfaceColor;
  if (els.brandTextColor) els.brandTextColor.value = state.brandSettings.textColor;
  if (els.brandMutedColor) els.brandMutedColor.value = state.brandSettings.mutedColor;
  if (els.brandBorderColor) els.brandBorderColor.value = state.brandSettings.borderColor;
	  if (els.brandSceneColor) els.brandSceneColor.value = state.brandSettings.sceneColor;
	  if (els.heroTitleInput) els.heroTitleInput.value = state.brandSettings.heroTitle;
	  if (els.heroTextInput) els.heroTextInput.value = state.brandSettings.heroText;
	  renderHeroEditorTargetOptions();
	  renderContentEditors();
	}

	function applyHeroSettings() {
  if (els.heroTitle) els.heroTitle.textContent = state.brandSettings.heroTitle;
  if (els.heroText) els.heroText.textContent = state.brandSettings.heroText;
	  if (els.heroImage) els.heroImage.src = state.brandSettings.heroImage || defaultHeroImage;
	}

function renderPlanCards() {
  if (!els.pricingGrid) return;
  const plans = normalizeContentSettings(state.brandSettings.content).plans;
  els.pricingGrid.innerHTML = plans.map((plan) => {
    const featured = plan.plan === "pro";
    const active = state.account.plan === plan.plan;
    return `
      <article class="pricing-card${featured ? " featured" : ""}">
        <span>${escapeHtml(plan.name)}</span>
        <div class="price-line"><strong>${escapeHtml(plan.price)}</strong><small>${escapeHtml(plan.period)}</small></div>
        <small>${escapeHtml(plan.exports)}. ${escapeHtml(plan.description)}</small>
        <button type="button" class="${featured && !active ? "accent" : ""}" data-plan-pick="${escapeHtml(plan.plan)}">${active ? "Current plan" : "Enter code"}</button>
      </article>
    `;
  }).join("");
}

function renderMarketingContent() {
  const content = normalizeContentSettings(state.brandSettings.content);
  if (els.sizeGuideHeading) els.sizeGuideHeading.textContent = content.sizes.heading;
  if (els.sizeGuideIntro) els.sizeGuideIntro.textContent = content.sizes.intro;
  if (els.sizeGuideRows) {
    els.sizeGuideRows.innerHTML = content.sizes.rows.map((row) => `
      <article class="size-card">
        <div class="size-card-head">
          <strong>${escapeHtml(row.size)}</strong>
          <span>${escapeHtml(row.label)}</span>
        </div>
        <dl>
          <div><dt>Face width</dt><dd>${row.headMin}-${row.headMax} mm</dd></div>
          <div><dt>Frame width</dt><dd>${escapeHtml(row.frameWidth)}</dd></div>
          <div><dt>Lens width</dt><dd>${escapeHtml(row.lensWidth)}</dd></div>
          <div><dt>Bridge</dt><dd>${row.bridgeMin}-${row.bridgeMax} mm</dd></div>
          <div><dt>Temple</dt><dd>${row.templeMin}-${row.templeMax} mm</dd></div>
        </dl>
        <p>${escapeHtml(row.note)}</p>
      </article>
    `).join("");
  }
  if (els.printGuideHeading) els.printGuideHeading.textContent = content.printGuide.heading;
  if (els.printGuideIntro) els.printGuideIntro.textContent = content.printGuide.intro;
  if (els.printGuideFigure && els.printGuideImage) {
    const image = sanitizeContentImage(content.printGuide.image, "");
    els.printGuideFigure.hidden = !image;
    if (image) {
      els.printGuideImage.src = image;
      if (els.lightboxImage) els.lightboxImage.src = image;
    }
  }
  if (els.roadmapHeading) els.roadmapHeading.textContent = content.roadmap.heading;
  if (els.roadmapItems) {
    els.roadmapItems.innerHTML = content.roadmap.items.map((item) => `
      <article class="roadmap-item">
        <span>${escapeHtml(item.status)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.description)}</p>
      </article>
    `).join("");
  }
  if (els.licenseInfoHeading) els.licenseInfoHeading.textContent = content.license.heading;
  if (els.licenseInfoBody) els.licenseInfoBody.textContent = content.license.body;
  if (els.faqHeading) els.faqHeading.textContent = content.faq.heading;
  if (els.faqItems) {
    els.faqItems.innerHTML = content.faq.items.map((item) => `
      <details class="faq-item">
        <summary>${escapeHtml(item.question)}</summary>
        <p>${escapeHtml(item.answer)}</p>
      </details>
    `).join("");
  }
}

function renderContentEditors() {
  if (!isDeveloper()) return;
  const content = normalizeContentSettings(state.brandSettings.content);
  if (els.planContentEditor) {
    els.planContentEditor.innerHTML = content.plans.map((plan) => `
      <fieldset class="content-editor-card" data-plan-editor="${escapeHtml(plan.plan)}">
        <legend>${escapeHtml(plan.name)} plan</legend>
        <input data-plan-field="name" type="text" value="${escapeAttr(plan.name)}" placeholder="Plan name" />
        <input data-plan-field="price" type="text" value="${escapeAttr(plan.price)}" placeholder="$20" />
        <input data-plan-field="period" type="text" value="${escapeAttr(plan.period)}" placeholder="/ month" />
        <input data-plan-field="exports" type="text" value="${escapeAttr(plan.exports)}" placeholder="15 3MF downloads per month" />
        <textarea data-plan-field="description" rows="3" placeholder="Plan description">${escapeHtml(plan.description)}</textarea>
      </fieldset>
    `).join("");
  }
  if (els.pageContentEditor) {
    els.pageContentEditor.innerHTML = `
      <fieldset class="content-editor-card wide">
        <legend>Sizes</legend>
        <input data-content-field="sizes.heading" type="text" value="${escapeAttr(content.sizes.heading)}" placeholder="Sizes" />
        <textarea data-content-field="sizes.intro" rows="3">${escapeHtml(content.sizes.intro)}</textarea>
        <div class="size-editor-grid">
          ${content.sizes.rows.map((row) => `
            <div class="size-editor-row" data-size-editor="${escapeHtml(row.size)}">
              <strong>${escapeHtml(row.size)}</strong>
              <input data-size-field="label" type="text" value="${escapeAttr(row.label)}" aria-label="${escapeAttr(row.size)} label" />
              <input data-size-field="headMin" type="number" value="${row.headMin}" aria-label="${escapeAttr(row.size)} head min" />
              <input data-size-field="headMax" type="number" value="${row.headMax}" aria-label="${escapeAttr(row.size)} head max" />
              <input data-size-field="frameWidth" type="text" value="${escapeAttr(row.frameWidth)}" aria-label="${escapeAttr(row.size)} frame width" />
              <input data-size-field="lensWidth" type="text" value="${escapeAttr(row.lensWidth)}" aria-label="${escapeAttr(row.size)} lens width" />
              <input data-size-field="bridgeMin" type="number" value="${row.bridgeMin}" aria-label="${escapeAttr(row.size)} bridge min" />
              <input data-size-field="bridgeMax" type="number" value="${row.bridgeMax}" aria-label="${escapeAttr(row.size)} bridge max" />
              <input data-size-field="templeMin" type="number" value="${row.templeMin}" aria-label="${escapeAttr(row.size)} temple min" />
              <input data-size-field="templeMax" type="number" value="${row.templeMax}" aria-label="${escapeAttr(row.size)} temple max" />
              <input data-size-field="note" type="text" value="${escapeAttr(row.note)}" aria-label="${escapeAttr(row.size)} note" />
            </div>
          `).join("")}
        </div>
      </fieldset>
      <fieldset class="content-editor-card wide">
        <legend>How to print it</legend>
        <input data-content-field="printGuide.heading" type="text" value="${escapeAttr(content.printGuide.heading)}" />
        <textarea data-content-field="printGuide.intro" rows="4">${escapeHtml(content.printGuide.intro)}</textarea>
        <div class="content-file-actions">
          <label class="file-button">
            <input data-print-guide-image type="file" accept="image/*" />
            <span>Print guide image</span>
          </label>
          <button type="button" data-clear-print-guide-image>Clear image</button>
          <small>${content.printGuide.image ? "Image attached" : "No image selected"}</small>
        </div>
      </fieldset>
      <fieldset class="content-editor-card wide">
        <legend>Roadmap</legend>
        <input data-content-field="roadmap.heading" type="text" value="${escapeAttr(content.roadmap.heading)}" />
        <textarea data-list-field="roadmap.items" rows="5">${escapeHtml(serializeRoadmapItems(content.roadmap.items))}</textarea>
      </fieldset>
      <fieldset class="content-editor-card wide">
        <legend>License</legend>
        <input data-content-field="license.heading" type="text" value="${escapeAttr(content.license.heading)}" />
        <textarea data-content-field="license.body" rows="4">${escapeHtml(content.license.body)}</textarea>
      </fieldset>
      <fieldset class="content-editor-card wide">
        <legend>FAQ</legend>
        <input data-content-field="faq.heading" type="text" value="${escapeAttr(content.faq.heading)}" />
        <textarea data-list-field="faq.items" rows="6">${escapeHtml(serializeFaqItems(content.faq.items))}</textarea>
      </fieldset>
    `;
  }
}

function serializeRoadmapItems(items = []) {
  return items.map((item) => `${item.title} | ${item.status} | ${item.description}`).join("\n");
}

function serializeFaqItems(items = []) {
  return items.map((item) => `${item.question} | ${item.answer}`).join("\n");
}

function readContentSettingsFromEditor() {
  const base = normalizeContentSettings(state.brandSettings.content);
  const planById = new Map(base.plans.map((plan) => [plan.plan, { ...plan }]));
  els.planContentEditor?.querySelectorAll("[data-plan-editor]").forEach((card) => {
    const planId = card.dataset.planEditor;
    const current = planById.get(planId);
    if (!current) return;
    card.querySelectorAll("[data-plan-field]").forEach((field) => {
      current[field.dataset.planField] = field.value;
    });
  });
  const content = {
    ...base,
    plans: [...planById.values()]
  };
  els.pageContentEditor?.querySelectorAll("[data-content-field]").forEach((field) => {
    setContentPath(content, field.dataset.contentField, field.value);
  });
  const sizeById = new Map(content.sizes.rows.map((row) => [row.size, { ...row }]));
  els.pageContentEditor?.querySelectorAll("[data-size-editor]").forEach((rowEl) => {
    const sizeId = rowEl.dataset.sizeEditor;
    const row = sizeById.get(sizeId);
    if (!row) return;
    rowEl.querySelectorAll("[data-size-field]").forEach((field) => {
      row[field.dataset.sizeField] = field.value;
    });
  });
  content.sizes.rows = content.sizes.rows.map((row) => sizeById.get(row.size) || row);
  const roadmapField = els.pageContentEditor?.querySelector('[data-list-field="roadmap.items"]');
  if (roadmapField) content.roadmap.items = parseRoadmapItems(roadmapField.value);
  const faqField = els.pageContentEditor?.querySelector('[data-list-field="faq.items"]');
  if (faqField) content.faq.items = parseFaqItems(faqField.value);
  return normalizeContentSettings(content);
}

function setContentPath(target, path, value) {
  const [section, field] = String(path || "").split(".");
  if (!section || !field || !target[section]) return;
  target[section][field] = value;
}

function parseRoadmapItems(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((line) => {
      const [title = "", status = "Planned", description = ""] = line.split("|").map((part) => part.trim());
      return { title, status, description };
    });
}

function parseFaqItems(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((line) => {
      const [question = "", answer = ""] = line.split("|").map((part) => part.trim());
      return { question, answer };
    });
}

	function syncBrandSettingsFromInputs() {
	  state.brandSettings = normalizeBrandSettings({
	    ...state.brandSettings,
    accentColor: els.brandAccentText?.value || els.brandAccentColor?.value || state.brandSettings.accentColor,
    backgroundColor: els.brandBackgroundColor?.value || state.brandSettings.backgroundColor,
    surfaceColor: els.brandSurfaceColor?.value || state.brandSettings.surfaceColor,
    textColor: els.brandTextColor?.value || state.brandSettings.textColor,
    mutedColor: els.brandMutedColor?.value || state.brandSettings.mutedColor,
	    borderColor: els.brandBorderColor?.value || state.brandSettings.borderColor,
	    sceneColor: els.brandSceneColor?.value || state.brandSettings.sceneColor,
	    heroTitle: els.heroTitleInput?.value || state.brandSettings.heroTitle,
	    heroText: els.heroTextInput?.value || state.brandSettings.heroText,
	    heroModelId: els.heroEditorTarget?.value || state.brandSettings.heroModelId,
	    content: readContentSettingsFromEditor()
	  });
	  applyBrandSettings();
	}

async function hydrateSystemStatus() {
  try {
    const payload = await apiRequest("/api/system");
    if (payload.storage) state.system.storage = payload.storage;
  } catch {
    state.system.storage = {
      persistent: false,
      source: "unknown",
      message: "Could not verify Railway storage."
    };
  }
  renderStorageStatus();
}

function renderStorageStatus() {
  if (!els.storageStatusNote) return;
  if (!isDeveloper()) {
    els.storageStatusNote.textContent = "";
    if (els.storageDebugPanel) {
      els.storageDebugPanel.hidden = true;
      els.storageDebugPanel.textContent = "";
    }
    return;
  }
  const storage = state.system.storage || {};
  const warnings = Array.isArray(storage.warnings) && storage.warnings.length ? ` ${storage.warnings.join(" ")}` : "";
  els.storageStatusNote.textContent = storage.persistent
    ? `Persistent storage active: ${storage.source || "Railway volume"}. Accounts, colors and collections should survive deploys.${warnings}`
    : `${storage.message || "Persistent storage is not configured."} Add a Railway Volume and set FRAME_LAB_DATA_DIR to its mount path, for example /data.`;
}

function formatStorageBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function renderStorageDebug(payload) {
  if (!els.storageDebugPanel) return;
  const file = payload.file || {};
  const counts = payload.counts || {};
  const storage = payload.storage || {};
  els.storageDebugPanel.hidden = false;
  els.storageDebugPanel.textContent = [
    `Persistent: ${storage.persistent ? "yes" : "no"} (${storage.source || "unknown"})`,
    `Data dir: ${payload.dataDir || "-"}`,
    `DB file: ${payload.dbPath || "-"}`,
    `DB exists: ${file.exists ? "yes" : "no"}`,
    `DB size: ${formatStorageBytes(file.bytes)}`,
    `DB updated: ${file.updatedAt || "-"}`,
    `Users: ${counts.users ?? 0}`,
    `Sessions: ${counts.sessions ?? 0}`,
    `Collections: ${counts.collections ?? 0}`,
    `Components: ${counts.components ?? 0}`,
    `Design submissions: ${counts.designSubmissions ?? 0}`,
    `Downloads: ${counts.downloads ?? 0}`,
    `Generated codes: ${counts.licenseCodes ?? 0}`
  ].join("\n");
}

async function loadStorageDebug(options = {}) {
  if (!isDeveloper() || !sessionToken()) {
    if (els.storageDebugPanel) {
      els.storageDebugPanel.hidden = true;
      els.storageDebugPanel.textContent = "";
    }
    return false;
  }
  try {
    const payload = await apiRequest("/api/admin/storage-debug");
    renderStorageDebug(payload);
    return true;
  } catch (error) {
    if (!options.silent && els.storageStatusNote) {
      els.storageStatusNote.textContent = error.message || "Could not load storage diagnostics.";
    }
    return false;
  }
}

async function hydrateBrandSettings() {
  try {
    const payload = await apiRequest("/api/settings");
    if (payload.settings) {
      state.brandSettings = normalizeBrandSettings(payload.settings);
      applyBrandSettings();
      return true;
    }
  } catch {
    applyBrandSettings();
  }
  return false;
}

function setBrandColor(key, value, options = {}) {
  if (!Object.prototype.hasOwnProperty.call(defaultBrandSettings, key) || !key.endsWith("Color")) return false;
  const color = sanitizeHexColor(value, "");
  if (!color) {
    if (els.brandSettingsNote) els.brandSettingsNote.textContent = "Use a six digit hex color, for example #c96b34.";
    return false;
  }
  state.brandSettings[key] = color;
  applyBrandSettings();
  if (els.brandSettingsNote && options.previewOnly) els.brandSettingsNote.textContent = "Previewing brand colors. Save to publish them.";
  return true;
}

function setBrandAccent(value, options = {}) {
  return setBrandColor("accentColor", value, options);
}

async function saveBrandSettings() {
  if (!isDeveloper() || !sessionToken()) {
    if (els.brandSettingsNote) els.brandSettingsNote.textContent = "Developer login is required to save brand settings.";
    return;
  }
  syncBrandSettingsFromInputs();
  if (!setBrandAccent(state.brandSettings.accentColor)) return;
  try {
    const payload = await apiRequest("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ settings: state.brandSettings })
    });
    state.brandSettings = normalizeBrandSettings(payload.settings);
    applyBrandSettings();
    if (els.brandSettingsNote) els.brandSettingsNote.textContent = "Brand settings saved.";
  } catch (error) {
    if (els.brandSettingsNote) els.brandSettingsNote.textContent = error.message || "Could not save brand settings.";
  }
}

async function resetBrandSettings() {
  state.brandSettings = structuredClone(defaultBrandSettings);
  applyBrandSettings();
  await saveBrandSettings();
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-attr]").forEach((element) => {
    element.dataset.i18nAttr.split(";").forEach((item) => {
      const [attr, key] = item.split(":");
      if (attr && key) element.setAttribute(attr, t(key));
    });
  });
  updateAccountUi();
  applyHeroSettings();
  syncStudioModeUi();
}

function buildControls() {
  els.controls.innerHTML = "";
  parameterSchema.filter(([key]) => visibleParameterKeys.has(key)).forEach(([key, label, hint, min, max, step, unit]) => {
    const translated = getParameterText(key, label, hint);
    const row = document.createElement("div");
    row.className = "control";
    row.innerHTML = `
      <label for="${key}">
        <span>${translated.label}</span>
        <small>${translated.hint}</small>
      </label>
      <input id="${key}" data-param="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${state.params[key]}" />
      <output id="${key}Output">${formatValue(state.params[key], unit)}</output>
    `;
    els.controls.append(row);
  });
}

function buildBuilderControls() {
  disposeComponentPreviews();
  const parts = [
    { key: "front", label: t("frontComponent"), items: componentLibrary.fronts },
    { key: "leftTemple", label: t("leftTempleComponent"), items: templeItemsForKey("leftTemple") },
    { key: "rightTemple", label: t("rightTempleComponent"), items: templeItemsForKey("rightTemple") },
    { key: "lens", label: t("lensComponent"), items: componentLibrary.lenses, optional: true }
  ];
  const sizedParts = parts.map((part) => ({
    ...part,
    allItems: part.items,
    items: part.items.filter((item) => item.sizes?.[state.assemblySize])
  }));
  els.builderControls.innerHTML = `${assemblySizeTemplate()}${colorSlotPaletteTemplate()}${sizedParts.map((part) => componentCardTemplate(part)).join("")}`;
  renderComponentPreviews(sizedParts);
  renderComponentFileList();
}

function assemblySizeTemplate() {
  const completeSizes = availableAssemblySizes();
  return `
    <article class="assembly-size-panel">
      <strong>${t("frameSize")}</strong>
      <div class="size-row" role="group" aria-label="${t("frameSize")}">
        ${["S", "M", "L"].map((size) => `
          <button type="button" class="size-chip${state.assemblySize === size ? " active" : ""}" data-assembly-size="${size}" aria-pressed="${state.assemblySize === size}" ${completeSizes.includes(size) || state.assemblySize === size ? "" : "disabled"}>
            ${size}
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

function availableAssemblySizes() {
  const requiredParts = [
    componentLibrary.fronts,
    templeItemsForKey("leftTemple"),
    templeItemsForKey("rightTemple")
  ];
  return ["S", "M", "L"].filter((size) => requiredParts.every((items) => items.some((item) => item.sizes?.[size])));
}

function colorSlotPaletteTemplate() {
  const slots = normalizeColorSlots(state.colorSlots);
  return `
    <article class="color-slots-panel">
      <div class="color-slots-head">
        <strong>Color palette</strong>
        <small>Edit slots</small>
      </div>
      <div class="color-slots-grid">
        ${slots.map((color, index) => `
          <button type="button" class="color-slot-editor${state.colorEditor.type === "slot" && state.colorEditor.index === index ? " active" : ""}" style="--slot-color:${escapeHtml(color)}" data-edit-color-slot="${index}" aria-label="Edit color slot ${index + 1}" aria-expanded="${state.colorEditor.type === "slot" && state.colorEditor.index === index}">
            <span aria-hidden="true"></span>
            <small>${index + 1}</small>
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

function componentCardTemplate(part) {
  const selection = state.assembly[part.key];
  const selectedModel = part.items.find((item) => item.id === selection.modelId) || (part.optional ? null : part.items[0]);
  if (!selectedModel && part.items.length === 0) {
    const hasOtherSizes = Boolean(part.allItems?.length);
    const detail = hasOtherSizes ? `No ${state.assemblySize} option available` : t("noLensComponent");
    const note = hasOtherSizes
      ? `${escapeHtml(part.label)} is not available in size ${state.assemblySize}.`
      : `${escapeHtml(part.label)} is not available in this collection.`;
    return `
      <article class="component-card">
        <div class="component-head">
          <div>
            <strong>${escapeHtml(part.label)}</strong>
            <small>${detail}</small>
          </div>
        </div>
        <div class="compatibility-note">${note}</div>
      </article>
    `;
  }
  if (!selectedModel && part.optional) {
    const options = [noLensOptionTemplate(part), ...part.items.map((item) => optionCardTemplate(part, item, false))].join("");
    return `
      <article class="component-card">
        <div class="component-head">
          <div>
            <strong>${escapeHtml(part.label)}</strong>
            <small>${t("noLensComponent")}</small>
          </div>
        </div>
        <details class="component-options" data-component-options="${part.key}" ${state.openComponentOptions[part.key] ? "open" : ""}>
          <summary>${t("variants")} (${part.items.length})</summary>
          <div class="component-option-grid">${options}</div>
        </details>
      </article>
    `;
  }
  const options = [
    ...(part.optional ? [noLensOptionTemplate(part)] : []),
    ...part.items.map((item) => optionCardTemplate(part, item, item.id === selectedModel.id))
  ].join("");
  const color = state.componentColors[part.key] || selectedModel.materialColor || state.frameColor;
  const slots = normalizeColorSlots(state.colorSlots);
  const matchesSlot = slots.findIndex((slotColor) => sanitizeHexColor(slotColor) === sanitizeHexColor(color));
  const chosenCustom = state.componentColorSources[part.key] === "custom";
  const activeSlotIndex = chosenCustom ? -1 : matchesSlot;
  const customActive = chosenCustom || activeSlotIndex < 0;
  const editorOpen = state.colorEditor.type === "component" && state.colorEditor.key === part.key;
  return `
    <article class="component-card">
      <div class="component-head">
        <div>
          <strong>${escapeHtml(part.label)}</strong>
          <small>${escapeHtml(selectedModel.name)}</small>
        </div>
      </div>
      <div class="component-color-row">
        <span class="component-color-row-label">Color</span>
        <div class="component-color-slots" aria-label="${escapeHtml(part.label)} color options">
          ${slots.map((slotColor, index) => `
            <button type="button" class="color-slot-button${activeSlotIndex === index ? " active" : ""}" style="--slot-color:${escapeHtml(slotColor)}" data-apply-color-slot="${part.key}" data-component-label="${escapeHtml(part.label)}" data-color="${escapeHtml(slotColor)}" title="Choose color slot ${index + 1}" aria-pressed="${activeSlotIndex === index}"></button>
          `).join("")}
          <button type="button" class="component-color${customActive ? " active" : ""}${editorOpen ? " open" : ""}" style="--component-color:${escapeHtml(color)}" data-open-component-color="${part.key}" data-component-label="${escapeHtml(part.label)}" data-current-color="${escapeHtml(color)}" aria-label="Choose custom ${escapeHtml(part.label)} color" aria-pressed="${customActive}" aria-expanded="${editorOpen}">
            <span class="component-color-chip" aria-hidden="true"></span>
            <span class="component-color-text">Custom</span>
          </button>
        </div>
      </div>
      <details class="component-options" data-component-options="${part.key}" ${state.openComponentOptions[part.key] ? "open" : ""}>
        <summary>${t("variants")} (${part.items.length})</summary>
        <div class="component-option-grid">${options}</div>
      </details>
    </article>
  `;
}

function openColorPickerEditor({ type, key = "", index = -1, color, source = "", title }) {
  state.colorEditor = {
    type,
    key,
    index,
    source,
    draft: sanitizeHexColor(color, defaultAccentColor)
  };
  els.colorPickerTitle.textContent = title;
  els.colorPickerInput.value = state.colorEditor.draft;
  updateColorPickerDisplay();
  els.colorPickerPanel.hidden = false;
  document.body.classList.add("color-dialog-open");
  els.colorPickerInput.focus({ preventScroll: true });
  buildBuilderControls();
}

function updateColorPickerDraft() {
  state.colorEditor.draft = sanitizeHexColor(els.colorPickerInput.value, defaultAccentColor);
  updateColorPickerDisplay();
}

function updateColorPickerDisplay() {
  els.colorPickerPanel.style.setProperty("--draft-color", state.colorEditor.draft);
  els.colorPickerValue.textContent = state.colorEditor.draft.toUpperCase();
}

function closeColorPickerEditor(options = {}) {
  state.colorEditor = { type: "", key: "", index: -1, source: "", draft: "" };
  if (els.colorPickerPanel) els.colorPickerPanel.hidden = true;
  document.body.classList.remove("color-dialog-open");
  if (options.rebuild !== false) buildBuilderControls();
}

function applyColorPickerEditor() {
  const editor = { ...state.colorEditor };
  if (!editor.type) return;
  if (editor.type === "slot") {
    state.colorSlots[editor.index] = sanitizeHexColor(editor.draft, state.colorSlots[editor.index] || defaultAccentColor);
    state.colorSlots = normalizeColorSlots(state.colorSlots);
    persistColorSlots();
    closeColorPickerEditor({ rebuild: false });
    buildBuilderControls();
    return;
  }
  state.componentColors[editor.key] = sanitizeHexColor(editor.draft, state.componentColors[editor.key] || defaultAccentColor);
  state.componentColorSources[editor.key] = editor.source === "custom" ? "custom" : "slot";
  closeColorPickerEditor({ rebuild: false });
  buildBuilderControls();
  render({ fitView: false });
  syncActiveModel({ persist: false });
  scheduleModelPersist();
}

function optionCardTemplate(part, item, active) {
  return `
    <button type="button" class="component-option${active ? " active" : ""}" data-component-option="${part.key}" data-model-id="${item.id}">
      <canvas class="component-option-canvas" data-option-preview="${part.key}:${item.id}" aria-label="${escapeHtml(item.name)} 3D"></canvas>
      <span class="component-option-main">
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(componentOptionMeta(part, item))}</small>
      </span>
    </button>
  `;
}

function componentOptionMeta(part, item) {
  const side = item.kind === "temple" ? ` · ${templeSideLabel(item.templeSide)}` : "";
  return `${componentTypeLabel(part.key)}${side}`;
}

function noLensOptionTemplate(part) {
  return `
    <button type="button" class="component-option${state.assembly[part.key].modelId ? "" : " active"} component-option-empty" data-component-option="${part.key}" data-model-id="">
      <span class="component-option-placeholder"></span>
      <span class="component-option-main">
        <strong>${t("noLensComponent")}</strong>
        <small>${t("lensComponent")}</small>
      </span>
    </button>
  `;
}

function componentTypeLabel(keyOrKind) {
  if (keyOrKind === "front") return t("frontComponent");
  if (keyOrKind === "lens") return t("lensComponent");
  return t("templeComponent");
}

function templeSideLabel(side) {
  const normalized = normalizeTempleSide(side);
  if (normalized === "left") return t("leftSide");
  if (normalized === "right") return t("rightSide");
  return t("universalSide");
}

function disposeComponentPreviews() {
  componentPreviewRenderers = [];
}

function renderComponentPreviews(parts) {
  requestAnimationFrame(() => {
    parts.forEach((part) => {
      part.items.forEach((optionItem) => {
        const optionCanvas = els.builderControls.querySelector(`[data-option-preview="${part.key}:${optionItem.id}"]`);
        if (optionCanvas) renderComponentPreviewCanvas(optionCanvas, part.key, optionItem);
      });
    });
  });
}

function renderComponentPreviewCanvas(canvas, key, item) {
  const width = Math.max(120, canvas.clientWidth || 160);
  const height = Math.max(86, canvas.clientHeight || 104);
  const previewScene = new THREE.Scene();
  previewScene.background = new THREE.Color(previewBackgroundColor());
  const previewCamera = new THREE.PerspectiveCamera(34, width / height, 0.1, 1000);
  previewCamera.position.set(42, 34, 112);
  previewCamera.lookAt(0, 0, 0);

  if (!sharedComponentPreviewRenderer) {
    sharedComponentPreviewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    sharedComponentPreviewRenderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  const previewRenderer = sharedComponentPreviewRenderer;
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  previewRenderer.setSize(width, height, false);

  previewScene.add(new THREE.HemisphereLight("#fff6e8", "#050708", 2.4));
  const light = new THREE.DirectionalLight("#ffffff", 2.2);
  light.position.set(80, 90, 120);
  previewScene.add(light);

  const group = item.meshObject
    ? makeUploadedPreviewMesh(item)
    : key === "front" ? makeFrontPreviewMesh(item) : key === "lens" ? new THREE.Group() : makeTemplePreviewMesh(item, key === "leftTemple" ? -1 : 1);
  previewScene.add(group);
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) {
    previewRenderer.render(previewScene, previewCamera);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      canvas.width = Math.round(width * Math.min(window.devicePixelRatio, 2));
      canvas.height = Math.round(height * Math.min(window.devicePixelRatio, 2));
      ctx.drawImage(previewRenderer.domElement, 0, 0, canvas.width, canvas.height);
    }
    return;
  }
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const distance = Math.max(55, sphere.radius * 2.35);
  previewCamera.position.set(sphere.center.x + sphere.radius * 0.4, sphere.center.y + sphere.radius * 0.35, sphere.center.z + distance);
  previewCamera.lookAt(sphere.center);
  previewRenderer.render(previewScene, previewCamera);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    canvas.width = Math.round(width * Math.min(window.devicePixelRatio, 2));
    canvas.height = Math.round(height * Math.min(window.devicePixelRatio, 2));
    ctx.drawImage(previewRenderer.domElement, 0, 0, canvas.width, canvas.height);
  }
}

function makeFrontPreviewMesh(item) {
  const material = previewMaterial(item);
  const group = new THREE.Group();
  const size = firstSize(item);
  const p = { ...defaultParams, ...size };
  const center = (p.bridge_width + p.lens_width) / 2;
  [-center, center].forEach((x) => {
    const outer = roundedRectShape(p.lens_width + p.rim_thickness * 2.15, p.lens_height + p.rim_thickness * 2.05, p.corner_radius + p.rim_thickness * 0.9);
    outer.holes.push(roundedRectShape(p.lens_width, p.lens_height, p.corner_radius));
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, {
      depth: p.frame_depth,
      bevelEnabled: true,
      bevelThickness: 0.45,
      bevelSize: 0.45,
      bevelSegments: 2
    }).center(), material);
    rim.position.x = x;
    group.add(rim);
  });
  const brow = new THREE.Mesh(roundedPrismGeometry(p.bridge_width + p.lens_width * 2 + p.rim_thickness * 5.3, p.rim_thickness, p.frame_depth, 2, 0.35), material);
  brow.position.y = p.lens_height / 2 + p.rim_thickness * 0.72;
  group.add(brow);
  const bridge = new THREE.Mesh(roundedPrismGeometry(p.bridge_width + p.rim_thickness * 2.35, p.rim_thickness * 1.1, p.frame_depth, 1.8, 0.3), material);
  bridge.position.y = p.lens_height * 0.08;
  group.add(bridge);
  group.rotation.set(-0.34, 0.52, 0.03);
  return group;
}

function makeTemplePreviewMesh(item, side) {
  const material = previewMaterial(item);
  const group = new THREE.Group();
  const size = firstSize(item);
  const p = { ...defaultParams, ...size };
  const arm = new THREE.Mesh(roundedPrismGeometry(p.rim_thickness * 1.25, p.rim_thickness * 1.05, p.temple_length, p.rim_thickness * 0.32, 0.35), material);
  arm.position.z = -p.temple_length / 2;
  group.add(arm);
  const hook = new THREE.Mesh(roundedPrismGeometry(p.rim_thickness * 1.3, p.rim_thickness * 1.05, p.temple_drop, p.rim_thickness * 0.32, 0.35), material);
  hook.position.set(0, -p.temple_drop * 0.28, -p.temple_length - p.temple_drop * 0.28);
  hook.rotation.x = THREE.MathUtils.degToRad(-28);
  group.add(hook);
  const hinge = new THREE.Mesh(roundedPrismGeometry(p.hinge_width, p.rim_thickness * 1.7, p.frame_depth * 1.2, 1.5, 0.35), material);
  hinge.position.z = p.frame_depth * 0.5;
  group.add(hinge);
  group.rotation.set(-0.38, side * 0.42, side * 0.04);
  return group;
}

function makeUploadedPreviewMesh(item) {
  const clone = item.meshObject.clone(true);
  clone.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    child.geometry.computeVertexNormals();
    if (!child.material) child.material = previewMaterial(item);
  });
  normalizeObjectForScene(clone);
  clone.rotation.set(-0.28, 0.42, 0.02);
  return clone;
}

function previewMaterial(item, colorOverride = "") {
  return new THREE.MeshStandardMaterial({
    color: colorOverride || item.materialColor || (item.source === "uploaded" ? "#ff8a2a" : "#5f665f"),
    roughness: 0.42,
    metalness: 0.05
  });
}

function applyAssemblyToParams() {
  syncAssemblySizes();
  const front = selectedFront();
  const leftTemple = selectedTemple("leftTemple");
  const rightTemple = selectedTemple("rightTemple");
  const lens = selectedLens();
  if (!front || !leftTemple || !rightTemple) return;
  const frontSize = front.sizes[state.assembly.front.size] || firstSize(front);
  const leftSize = leftTemple.sizes[state.assembly.leftTemple.size] || firstSize(leftTemple);
  const rightSize = rightTemple.sizes[state.assembly.rightTemple.size] || firstSize(rightTemple);
  const templeLength = (leftSize.temple_length + rightSize.temple_length) / 2;
  const templeDrop = Math.max(leftSize.temple_drop, rightSize.temple_drop);
  const templeSpread = (leftSize.temple_spread + rightSize.temple_spread) / 2;
  state.params = {
    ...state.params,
    ...frontSize,
    temple_length: templeLength,
    temple_drop: templeDrop,
    temple_spread: templeSpread
  };
}

function setAssemblySize(size) {
  state.assemblySize = ["S", "M", "L"].includes(size) ? size : "M";
  syncAssemblySizes();
  [
    { key: "front", items: componentLibrary.fronts },
    { key: "leftTemple", items: templeItemsForKey("leftTemple") },
    { key: "rightTemple", items: templeItemsForKey("rightTemple") },
    { key: "lens", items: componentLibrary.lenses, optional: true }
  ].forEach(({ key, items, optional }) => {
    if (optional && !state.assembly[key].modelId) return;
    const selected = items.find((item) => item.id === state.assembly[key].modelId);
    if (selected?.sizes?.[state.assemblySize]) return;
    const replacement = items.find((item) => item.sizes?.[state.assemblySize]);
    if (replacement) state.assembly[key].modelId = replacement.id;
    else if (optional) state.assembly[key].modelId = "";
  });
}

function syncAssemblySizes() {
  ["front", "leftTemple", "rightTemple", "lens"].forEach((key) => {
    state.assembly[key].size = state.assemblySize;
  });
}

function selectFirstAssemblyVariants() {
  [
    { key: "front", items: componentLibrary.fronts },
    { key: "leftTemple", items: templeItemsForKey("leftTemple") },
    { key: "rightTemple", items: templeItemsForKey("rightTemple") },
    { key: "lens", items: componentLibrary.lenses, optional: true }
  ].forEach(({ key, items, optional }) => {
    const first = items.find((item) => item.sizes?.[state.assemblySize]) || null;
    if (first) {
      state.assembly[key].modelId = first.id;
    } else if (optional) {
      state.assembly[key].modelId = "";
    }
  });
  syncAssemblySizes();
}

function firstSize(item) {
  return item.sizes[Object.keys(item.sizes)[0]] || {};
}

function selectedFront() {
  return componentLibrary.fronts.find((item) => item.id === state.assembly.front.modelId) || componentLibrary.fronts[0];
}

function selectedTemple(key) {
  const items = templeItemsForKey(key);
  return items.find((item) => item.id === state.assembly[key].modelId) || items[0];
}

function selectedLens() {
  return componentLibrary.lenses.find((item) => item.id === state.assembly.lens.modelId) || null;
}

function normalizeTempleSide(value) {
  return ["left", "right", "universal"].includes(value) ? value : "universal";
}

function inferTempleSide(fileName = "") {
  const name = String(fileName).toLowerCase();
  if (/(^|[-_\s])(left|lewy|lhs)(?=[-_\s.]|$)/i.test(name)) return "left";
  if (/(^|[-_\s])(right|prawy|rhs)(?=[-_\s.]|$)/i.test(name)) return "right";
  return "universal";
}

function templeSideForKey(key) {
  return key === "rightTemple" ? "right" : "left";
}

function templeItemsForKey(key) {
  const side = templeSideForKey(key);
  const matching = componentLibrary.temples.filter((item) => {
    const itemSide = normalizeTempleSide(item.templeSide);
    return itemSide === side || itemSide === "universal";
  });
  return matching.length ? matching : componentLibrary.temples;
}

function visibleUploadedComponents() {
  return state.uploadedComponents.filter((component) => !state.hiddenComponentIds.has(component.id));
}

function componentSummary(component) {
  return normalizeComponentSummary(component, component?.kind);
}

function normalizeComponentSummary(value, forcedKind = "") {
  if (!value || typeof value !== "object") return null;
  const id = String(value.id || "").trim();
  if (!id) return null;
  const kind = ["front", "temple", "lens"].includes(value.kind) ? value.kind : forcedKind;
  if (!["front", "temple", "lens"].includes(kind)) return null;
  const fileName = String(value.fileName || value.name || "").trim();
  const templeSide = kind === "temple" ? normalizeTempleSide(value.templeSide || value.side || inferTempleSide(fileName)) : "";
  return {
    id,
    name: String(value.name || fileName || componentTypeLabel(kind)).trim(),
    kind,
    templeSide,
    size: ["S", "M", "L"].includes(value.size) ? value.size : "M",
    connector: String(value.connector || "FL-H8").trim() || "FL-H8",
    format: String(value.format || value.type || "").toLowerCase(),
    fileName,
    byteSize: Number(value.byteSize || 0) || 0
  };
}

function normalizeModelComponents(components) {
  if (!components || typeof components !== "object") return null;
  const normalizeList = (value, kind, templeSide = "") => {
    const list = Array.isArray(value) ? value : value ? [value] : [];
    return list
      .map((item) => normalizeComponentSummary(templeSide ? { ...item, templeSide } : item, kind))
      .filter(Boolean);
  };
  const legacyTemples = normalizeList(components.temples, "temple");
  const leftTemples = uniqueComponentsById([
    ...normalizeList(components.leftTemples, "temple", "left"),
    ...legacyTemples.filter((item) => item.templeSide === "left")
  ]);
  const rightTemples = uniqueComponentsById([
    ...normalizeList(components.rightTemples, "temple", "right"),
    ...legacyTemples.filter((item) => item.templeSide === "right")
  ]);
  const universalTemples = legacyTemples.filter((item) => normalizeTempleSide(item.templeSide) === "universal");
  const normalized = {
    front: normalizeList(components.front, "front"),
    temples: uniqueComponentsById(universalTemples),
    leftTemples,
    rightTemples,
    lenses: normalizeList(components.lenses, "lens")
  };
  return normalized.front.length || normalized.temples.length || normalized.leftTemples.length || normalized.rightTemples.length || normalized.lenses.length ? normalized : null;
}

function uniqueComponentsById(components) {
  return [...new Map(components.map((item) => [item.id, item])).values()];
}

function modelComponentsInOrder(model = currentModelRecord()) {
  const components = normalizeModelComponents(model?.components);
  if (!components) return [];
  return [...components.front, ...components.temples, ...components.leftTemples, ...components.rightTemples, ...components.lenses];
}

function componentsForModel(model = currentModelRecord()) {
  const visible = visibleUploadedComponents();
  const linkedComponents = modelComponentsInOrder(model);
  if (linkedComponents.length) {
    const visibleById = new Map(visible.map((component) => [component.id, component]));
    return linkedComponents.map((component) => visibleById.get(component.id)).filter(Boolean);
  }
  if (model?.id === defaultModelId) return visible.filter((component) => component.source === "asset" || !component.collectionId);
  return visible.filter((component) => component.collectionId === model?.id);
}

function componentsForActiveModel() {
  return componentsForModel(currentModelRecord());
}

function rebuildComponentLibrary() {
  componentLibrary.fronts = structuredClone(baseComponentLibrary.fronts);
  componentLibrary.temples = structuredClone(baseComponentLibrary.temples);
  componentLibrary.lenses = structuredClone(baseComponentLibrary.lenses);

  const visible = visibleUploadedComponents();
  const scoped = componentsForActiveModel();
  const scopedByKind = (kind) => scoped.filter((component) => component.kind === kind);
  const seedByKind = (kind) => visible.filter((component) => component.source === "asset" && component.kind === kind);
  const components = currentModelRecord()?.design ? [] : [
    ...(scopedByKind("front").length ? scopedByKind("front") : seedByKind("front")),
    ...(scopedByKind("temple").length ? scopedByKind("temple") : seedByKind("temple")),
    ...scopedByKind("lens")
  ];

  components.forEach((component) => {
    const target = component.kind === "front" ? componentLibrary.fronts : component.kind === "lens" ? componentLibrary.lenses : componentLibrary.temples;
    target.push(componentToLibraryItem(component));
  });
}

function componentToLibraryItem(component) {
  const sizeParams = component.kind === "front"
    ? {
        head_width: component.size === "S" ? 136 : component.size === "L" ? 164 : 150,
        bridge_width: component.size === "S" ? 17 : component.size === "L" ? 20 : 18,
        lens_width: component.size === "S" ? 49 : component.size === "L" ? 55 : 52,
        lens_height: component.size === "S" ? 35 : component.size === "L" ? 39 : 37
      }
    : component.kind === "lens"
      ? {}
    : {
        temple_length: component.size === "S" ? 135 : component.size === "L" ? 155 : 145,
        temple_drop: component.size === "S" ? 22 : component.size === "L" ? 36 : 30,
        temple_spread: component.size === "S" ? 7 : component.size === "L" ? 9 : 8
      };
  return {
    id: component.id,
    name: component.name,
    kind: component.kind,
    templeSide: component.kind === "temple" ? normalizeTempleSide(component.templeSide || inferTempleSide(component.fileName)) : "",
    connector: component.connector,
    source: component.source || "uploaded",
    collectionId: component.collectionId || "",
    fileName: component.fileName,
    format: component.format,
    analysis: component.analysis || null,
    materialColor: component.materialColor || component.analysis?.materialColor || null,
    meshObject: component.meshObject || null,
    sizes: {
      [component.size]: sizeParams
    }
  };
}

function renderComponentFileList() {
  if (!els.componentFileList) return;
  if (!state.editingModelId && !els.collectionEditorPanel.hidden) {
    els.componentFileList.innerHTML = `<div class="compatibility-note">Save the collection first, then add individual component options in this frame workspace.</div>`;
    return;
  }
  const components = componentsForActiveModel();
  if (!components.length) {
    els.componentFileList.innerHTML = `<div class="compatibility-note">${t("noComponents")}</div>`;
    return;
  }
  els.componentFileList.innerHTML = components.map((component) => `
    <div class="component-file-row">
      <div>
        <strong>${escapeHtml(component.name)}</strong>
        <small>${escapeHtml(component.fileName)}</small>
        <small>${escapeHtml(component.analysis?.summary || "")}</small>
      </div>
      ${component.materialColor || component.analysis?.materialColor ? `<span class="material-swatch" style="--swatch:${escapeHtml(component.materialColor || component.analysis.materialColor)}">${escapeHtml(component.materialColor || component.analysis.materialColor)}</span>` : ""}
      <span class="status">${escapeHtml(componentTypeLabel(component.kind))}</span>
      ${component.kind === "temple" ? `<span class="status">${escapeHtml(templeSideLabel(component.templeSide))}</span>` : ""}
      <span class="status">${component.size} · ${component.connector}</span>
      <small>${component.format.toUpperCase()} · ${component.source === "asset" ? "Test asset" : t("storedLocally")}</small>
      ${isDeveloper() ? `<button type="button" class="compact delete-button" data-component-delete="${component.id}">Delete</button>` : ""}
    </div>
  `).join("");
}

function renderFrameEditorAssets() {
  if (!els.frameEditorPhoto || !els.frameEditorComponentGallery) return;
  const model = state.editingModelId ? state.models.find((item) => item.id === state.editingModelId) : null;
  if (!model) {
    els.frameEditorPhoto.removeAttribute("src");
    els.frameEditorPhoto.alt = "";
    els.frameEditorPhotoCaption.textContent = "Save the frame first to manage its photo and components here.";
    els.frameEditorComponentGallery.innerHTML = `
      <div class="frame-component-empty">
        <strong>No frame selected.</strong>
        <small>Create or save a frame collection, then this workspace will show only its own component options.</small>
      </div>
    `;
    return;
  }
  const thumbnail = model.thumbnail || makeAutoCollectionThumbnail(model.name, model.params || defaultParams, model.category);
  els.frameEditorPhoto.src = thumbnail;
  els.frameEditorPhoto.alt = `${model.name} photo`;
  els.frameEditorPhotoCaption.textContent = model.name;

  const components = componentsForModel(model);
  if (!components.length) {
    els.frameEditorComponentGallery.innerHTML = `
      <div class="frame-component-empty">
        <strong>No component options yet.</strong>
        <small>Add fronts, left temples, right temples, or lens files for this frame only.</small>
      </div>
    `;
    return;
  }
  els.frameEditorComponentGallery.innerHTML = components.map((component) => {
    const previewKey = component.kind === "front"
      ? "front"
      : component.kind === "lens"
        ? "lens"
        : normalizeTempleSide(component.templeSide) === "right" ? "rightTemple" : "leftTemple";
    const color = component.materialColor || component.analysis?.materialColor || "";
    return `
      <article class="frame-component-card">
        <canvas class="frame-component-preview" data-frame-component-preview="${previewKey}" data-component-id="${escapeHtml(component.id)}" aria-label="${escapeHtml(component.name)} preview"></canvas>
        <div class="frame-component-copy">
          <strong>${escapeHtml(component.name)}</strong>
          <small>${escapeHtml(component.fileName)}</small>
          <div class="frame-component-meta">
            <span>${escapeHtml(componentTypeLabel(component.kind))}</span>
            ${component.kind === "temple" ? `<span>${escapeHtml(templeSideLabel(component.templeSide))}</span>` : ""}
            <span>${escapeHtml(component.size)} · ${escapeHtml(component.connector)}</span>
            ${color ? `<span class="material-swatch compact-swatch" style="--swatch:${escapeHtml(color)}">${escapeHtml(color)}</span>` : ""}
          </div>
        </div>
        ${isDeveloper() ? `<button type="button" class="compact delete-button" data-component-delete="${escapeHtml(component.id)}">Delete</button>` : ""}
      </article>
    `;
  }).join("");

  requestAnimationFrame(() => {
    els.frameEditorComponentGallery.querySelectorAll("[data-frame-component-preview]").forEach((canvas) => {
      const component = components.find((item) => item.id === canvas.dataset.componentId);
      if (!component) return;
      renderComponentPreviewCanvas(canvas, canvas.dataset.frameComponentPreview, componentToLibraryItem(component));
    });
  });
}

async function handleComponentFileListClick(event) {
  const button = event.target.closest("[data-component-delete]");
  if (!button) return;
  if (!isDeveloper()) {
    log("Component deletion is available only in developer mode.");
    return;
  }
  await deleteComponent(button.dataset.componentDelete);
}

async function deleteComponent(id) {
  const component = state.uploadedComponents.find((item) => item.id === id);
  if (!component) return;
  const activeKindCount = (component.kind === "front" ? componentLibrary.fronts : component.kind === "lens" ? componentLibrary.lenses : componentLibrary.temples).length;
  if (component.kind !== "lens" && component.source === "asset" && activeKindCount <= 1) {
    log(`Cannot delete the last ${componentTypeLabel(component.kind).toLowerCase()} component.`);
    return;
  }
  if (component.source === "asset") {
    state.hiddenComponentIds.add(component.id);
    persistHiddenComponents();
  } else {
    await deleteComponentRecord(component.id);
  }
  state.uploadedComponents = state.uploadedComponents.filter((item) => item.id !== component.id);
  removeComponentFromModels(component.id);
  rebuildComponentLibrary();
  repairAssemblyForActiveModel();
  applyAssemblyToParams();
  buildBuilderControls();
  buildControls();
  updateGeneratedSource();
  render();
  syncActiveModel();
  syncStudioModeUi();
  log(`Deleted component: ${component.name}.`);
}

function firstSizeKey(item) {
  return Object.keys(item?.sizes || {})[0] || "M";
}

function assemblyPartForItem(item) {
  return {
    modelId: item?.id || "",
    size: firstSizeKey(item)
  };
}

function normalizeAssemblyPart(value, fallbackItem = null) {
  const fallback = assemblyPartForItem(fallbackItem);
  if (!value || typeof value !== "object") return fallback;
  return {
    modelId: String(value.modelId || value.id || fallback.modelId || ""),
    size: ["S", "M", "L"].includes(value.size) ? value.size : fallback.size
  };
}

function assemblyPartExists(part, items) {
  return items.some((item) => item.id === part.modelId);
}

function repairAssemblyForActiveModel(model = currentModelRecord()) {
  state.assembly.front = normalizeAssemblyPart(model?.assembly?.front || state.assembly.front, componentLibrary.fronts[0]);
  if (!assemblyPartExists(state.assembly.front, componentLibrary.fronts)) {
    state.assembly.front = assemblyPartForItem(componentLibrary.fronts[0]);
  }

  ["leftTemple", "rightTemple"].forEach((key, index) => {
    const items = templeItemsForKey(key);
    const fallback = items[index] || items[0];
    state.assembly[key] = normalizeAssemblyPart(model?.assembly?.[key] || state.assembly[key], fallback);
    if (!assemblyPartExists(state.assembly[key], items)) {
      state.assembly[key] = assemblyPartForItem(fallback);
    }
  });

  const lensPart = normalizeAssemblyPart(model?.assembly?.lens || state.assembly.lens, null);
  state.assembly.lens = assemblyPartExists(lensPart, componentLibrary.lenses)
    ? lensPart
    : { modelId: "", size: "M" };
  const storedSize = model?.assembly?.size || state.assembly.front.size || "M";
  const completeSizes = availableAssemblySizes();
  setAssemblySize(completeSizes.includes(storedSize) ? storedSize : completeSizes[0] || storedSize);
  selectFirstAssemblyVariants();
}

function serializeAssemblySelection() {
  return {
    size: state.assemblySize,
    front: { ...state.assembly.front },
    leftTemple: { ...state.assembly.leftTemple },
    rightTemple: { ...state.assembly.rightTemple },
    lens: { ...state.assembly.lens }
  };
}

function removeComponentFromModels(componentId) {
  state.models.forEach((model) => {
    const components = normalizeModelComponents(model.components);
    if (!components) return;
    const before = JSON.stringify(components);
    components.front = components.front.filter((item) => item.id !== componentId);
    components.temples = components.temples.filter((item) => item.id !== componentId);
    components.leftTemples = components.leftTemples.filter((item) => item.id !== componentId);
    components.rightTemples = components.rightTemples.filter((item) => item.id !== componentId);
    components.lenses = components.lenses.filter((item) => item.id !== componentId);
    const after = JSON.stringify(components);
    if (before === after) return;
    model.components = components.front.length || components.temples.length || components.leftTemples.length || components.rightTemples.length || components.lenses.length ? components : null;
    ["front", "leftTemple", "rightTemple", "lens"].forEach((key) => {
      if (model.assembly?.[key]?.modelId === componentId) model.assembly[key] = { modelId: "", size: "M" };
    });
    model.updatedAt = Date.now();
  });
  persistModels({ syncBackend: false });
  scheduleCollectionsBackendSync();
}

function persistHiddenComponents() {
  localStorage.setItem(hiddenComponentsStorageKey, JSON.stringify([...state.hiddenComponentIds]));
}

function persistColorSlots() {
  localStorage.setItem(colorSlotsStorageKey, JSON.stringify(normalizeColorSlots(state.colorSlots)));
}

function render(options = {}) {
  const { fitView = true } = options;
  modelGroup.clear();
  modelGroup.position.set(0, 8, 0);
  modelBasePosition.copy(modelGroup.position);
  modelGroup.rotation.set(0, 0, 0);
  modelGroup.scale.setScalar(1);
  triangleCount = 0;
  if (state.meshObject) {
    renderMeshObject(state.meshObject);
  } else if (selectedAssemblyHasMeshes()) {
    renderUploadedAssembly();
  } else {
    renderParametricPreview();
  }
  updateMetrics();
  if (fitView) fitCameraToObject(modelGroup);
  els.polyCount.textContent = `${triangleCount.toLocaleString("en-US")} tris`;
  els.meshStatus.textContent = state.meshObject ? "STL" : selectedAssemblyHasMeshes() ? "3MF" : "Preview";
}

function selectedAssemblyHasMeshes() {
  return [selectedFront(), selectedTemple("leftTemple"), selectedTemple("rightTemple"), selectedLens()].some((item) => item?.meshObject);
}

function renderUploadedAssembly() {
  [
    { key: "front", item: selectedFront() },
    { key: "leftTemple", item: selectedTemple("leftTemple") },
    { key: "rightTemple", item: selectedTemple("rightTemple") },
    { key: "lens", item: selectedLens() }
  ].forEach(({ key, item }) => {
    if (!item?.meshObject) return;
    const clone = item.meshObject.clone(true);
    const overrideColor = state.componentColors[key];
    clone.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      child.geometry.computeVertexNormals();
      if (overrideColor) {
        child.material = previewMaterial(item, overrideColor);
      } else if (!child.material) {
        child.material = previewMaterial(item);
      }
      addTriangles(child.geometry);
    });
    modelGroup.add(clone);
  });
  centerObjectForViewerPivot(modelGroup);
  modelBasePosition.copy(modelGroup.position);
  applyViewerTransform();
  modelGroup.scale.setScalar(1);
}

function renderParametricPreview() {
  if (state.activeParametricDesign) {
    renderPublishedDesignPreview();
    return;
  }
  const p = state.params;
  const material = new THREE.MeshStandardMaterial({
    color: state.frameColor,
    roughness: 0.38,
    metalness: 0.04
  });

  const center = (p.bridge_width + p.lens_width) / 2;
  addRim(-center, p, material);
  addRim(center, p, material);
  addBrowBar(p, material);
  addBridge(p, material);
  addNosePads(p, material);
  addTemple(-1, p, material);
  addTemple(1, p, material);

  centerObjectForViewerPivot(modelGroup);
  modelBasePosition.copy(modelGroup.position);
  applyViewerTransform();
  modelGroup.scale.setScalar(1);
}

function renderPublishedDesignPreview() {
  const p = designGeometryParams(state.params);
  const style = normalizeDesignStyle(state.activeParametricDesign);
  const frameMaterial = new THREE.MeshStandardMaterial({ color: style.frameColor, roughness: 0.37, metalness: 0.035 });
  const detailMaterial = new THREE.MeshStandardMaterial({ color: style.detailColor, roughness: 0.42, metalness: 0.02 });
  const lensMaterial = new THREE.MeshPhysicalMaterial({ color: style.lensColor, transparent: true, opacity: 0.62, roughness: 0.16, transmission: 0.24 });
  const outerLensWidth = (p.head_width - p.bridge_width) / 2;
  const center = p.bridge_width / 2 + outerLensWidth / 2;
  [-1, 1].forEach((side) => {
    addDesignRim(side * center, p, outerLensWidth, frameMaterial, style, modelGroup);
    addDesignLens(side * center, p, lensMaterial, style, modelGroup);
    addDesignTemple(side, p, outerLensWidth, frameMaterial, detailMaterial, style, modelGroup);
  });
  if (style.browBar) addDesignBar(p.head_width, p.lens_height / 2 + p.rim_thickness * 0.72, p.rim_thickness * 1.05, p.frame_depth * 0.95, frameMaterial, p, modelGroup);
  addDesignBar(p.bridge_width + p.rim_thickness * 2.35, p.lens_height * 0.08, p.rim_thickness * 1.15, p.frame_depth, frameMaterial, p, modelGroup);
  const padGeometry = roundedPrismGeometry(p.nose_pad_width, p.rim_thickness * 1.45, p.frame_depth * 0.72, p.rim_thickness * 0.35, p.bevel * 0.45);
  [-1, 1].forEach((side) => {
    const pad = new THREE.Mesh(padGeometry, detailMaterial);
    pad.position.set(side * (p.bridge_width / 2 + p.nose_pad_width / 2), -p.lens_height / 4 - p.nose_pad_drop / 4, -p.frame_depth * 0.35);
    pad.rotation.z = side * THREE.MathUtils.degToRad(10);
    modelGroup.add(pad);
  });
  addTriangles(padGeometry, 2);
  centerObjectForViewerPivot(modelGroup);
  modelBasePosition.copy(modelGroup.position);
  applyViewerTransform();
}

function addRim(x, p, material) {
  const outer = roundedRectShape(p.lens_width + p.rim_thickness * 2.15, p.lens_height + p.rim_thickness * 2.05, p.corner_radius + p.rim_thickness * 0.9);
  const inner = roundedRectShape(p.lens_width, p.lens_height, p.corner_radius);
  outer.holes.push(inner);
  const rimGeometry = new THREE.ExtrudeGeometry(outer, {
    depth: p.frame_depth,
    bevelEnabled: p.bevel > 0,
    bevelThickness: Math.max(0.01, p.bevel),
    bevelSize: Math.max(0.01, p.bevel),
    bevelSegments: p.bevel > 0 ? 2 : 0
  });
  rimGeometry.center();
  const rim = new THREE.Mesh(rimGeometry, material);
  rim.position.x = x;
  modelGroup.add(rim);
  addTriangles(rimGeometry);
}

function addBrowBar(p, material) {
  const totalWidth = p.bridge_width + p.lens_width * 2 + p.rim_thickness * 5.3;
  const geometry = roundedPrismGeometry(totalWidth, p.rim_thickness * 1.05, p.frame_depth * 0.95, p.rim_thickness * 0.45, p.bevel * 0.75);
  const brow = new THREE.Mesh(geometry, material);
  brow.position.set(0, p.lens_height / 2 + p.rim_thickness * 0.72, 0.05);
  modelGroup.add(brow);
  addTriangles(geometry);
}

function addBridge(p, material) {
  const geometry = roundedPrismGeometry(p.bridge_width + p.rim_thickness * 2.35, p.rim_thickness * 1.15, p.frame_depth, p.rim_thickness * 0.35, p.bevel * 0.6);
  const bridge = new THREE.Mesh(geometry, material);
  bridge.position.y = p.lens_height * 0.08;
  modelGroup.add(bridge);
  addTriangles(geometry);
}

function addNosePads(p, material) {
  const geometry = roundedPrismGeometry(p.nose_pad_width, p.rim_thickness * 1.45, p.frame_depth * 0.72, p.rim_thickness * 0.35, p.bevel * 0.45);
  [-1, 1].forEach((side) => {
    const pad = new THREE.Mesh(geometry, material);
    pad.position.set(side * (p.bridge_width / 2 + p.nose_pad_width / 2), -p.lens_height / 4 - p.nose_pad_drop / 4, -p.frame_depth * 0.35);
    pad.rotation.z = side * THREE.MathUtils.degToRad(10);
    modelGroup.add(pad);
  });
  addTriangles(geometry, 2);
}

function addTemple(side, p, material) {
  const center = (p.bridge_width + p.lens_width) / 2;
  const hingeX = side * (center + p.lens_width / 2 + p.rim_thickness + p.hinge_width / 2);
  const temple = new THREE.Group();
  temple.position.set(hingeX, p.lens_height * 0.28, -p.frame_depth * 0.08);
  temple.rotation.y = side * THREE.MathUtils.degToRad(p.temple_spread);

  const hingeGeometry = roundedPrismGeometry(p.hinge_width, p.rim_thickness * 1.7, p.frame_depth * 1.2, p.rim_thickness * 0.32, p.bevel * 0.6);
  const hinge = new THREE.Mesh(hingeGeometry, material);
  temple.add(hinge);
  addTriangles(hingeGeometry);

  addHingeBarrels(side, p, temple, material);

  const armGeometry = roundedPrismGeometry(p.rim_thickness * 1.25, p.rim_thickness * 1.05, p.temple_length, p.rim_thickness * 0.32, p.bevel * 0.5);
  const arm = new THREE.Mesh(armGeometry, material);
  arm.position.set(side * p.hinge_width * 0.34, 0.2, -p.temple_length / 2 - p.frame_depth * 0.5);
  temple.add(arm);
  addTriangles(armGeometry);

  const hookGeometry = roundedPrismGeometry(p.rim_thickness * 1.3, p.rim_thickness * 1.05, Math.max(1, p.temple_drop), p.rim_thickness * 0.32, p.bevel * 0.5);
  const hook = new THREE.Mesh(hookGeometry, material);
  hook.position.set(side * p.hinge_width * 0.34, -p.temple_drop * 0.28, -p.temple_length - p.frame_depth * 0.5 - p.temple_drop * 0.28);
  hook.rotation.x = THREE.MathUtils.degToRad(-28);
  temple.add(hook);
  addTriangles(hookGeometry);

  modelGroup.add(temple);
}

function addHingeBarrels(side, p, temple, material) {
  const barrelGeometry = new THREE.CylinderGeometry(p.rim_thickness * 0.34, p.rim_thickness * 0.34, p.hinge_width * 0.95, 20);
  [-1, 1].forEach((slot) => {
    const barrel = new THREE.Mesh(barrelGeometry, material);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(side * p.hinge_width * 0.52, slot * p.rim_thickness * 0.42, -p.frame_depth * 0.78);
    temple.add(barrel);
  });
  addTriangles(barrelGeometry, 2);

  const pinMaterial = new THREE.MeshStandardMaterial({ color: "#1b1713", roughness: 0.34, metalness: 0.2 });
  const pinGeometry = new THREE.CylinderGeometry(p.rim_thickness * 0.13, p.rim_thickness * 0.13, p.hinge_width * 1.15, 16);
  const pin = new THREE.Mesh(pinGeometry, pinMaterial);
  pin.rotation.z = Math.PI / 2;
  pin.position.set(side * p.hinge_width * 0.52, 0, -p.frame_depth * 0.78);
  temple.add(pin);
  addTriangles(pinGeometry);
}

function roundedPrismGeometry(width, height, depth, radius, bevel) {
  const geometry = new THREE.ExtrudeGeometry(roundedRectShape(width, height, radius), {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: Math.max(0.01, bevel),
    bevelSize: Math.max(0.01, bevel),
    bevelSegments: bevel > 0 ? 2 : 0
  });
  geometry.center();
  return geometry;
}

function renderMeshObject(object) {
  const clone = object.clone(true);
  const material = new THREE.MeshStandardMaterial({
    color: state.frameColor,
    roughness: 0.46,
    metalness: 0.04
  });
  clone.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry.computeVertexNormals();
    child.material = material;
    addTriangles(child.geometry);
  });
  modelGroup.add(clone);
  centerObjectForViewerPivot(modelGroup);
  modelBasePosition.copy(modelGroup.position);
  applyViewerTransform();
}

function roundedRectShape(width, height, radius) {
  const r = Math.min(radius, width / 2 - 0.01, height / 2 - 0.01);
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function createDefaultModel() {
  const seed = seedCollections[0];
  return {
    id: defaultModelId,
    name: seed.name,
    category: seed.category,
    description: seed.description,
    scadSource: sampleScad,
    params: { ...structuredClone(defaultParams), ...seed.params },
    lensMode: "none",
    thumbnail: "",
    components: null,
    assembly: null,
    order: seed.order || 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

async function loadStoredModels() {
  const remote = await fetchBackendCollections();
  if (remote.length) {
    const canonical = mergeSeedCollections(remote);
    localStorage.setItem(modelStorageKey, JSON.stringify(canonical));
    return canonical;
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(modelStorageKey) || "[]");
    const stored = Array.isArray(parsed)
      ? parsed.map(normalizeStoredModel).filter((model) => model && !legacyModelIds.has(model.id))
      : [];
    const merged = mergeSeedCollections(stored);
    localStorage.setItem(modelStorageKey, JSON.stringify(merged));
    return merged;
  } catch {
    return mergeSeedCollections([]);
  }
}

async function fetchBackendCollections() {
  try {
    const payload = await apiRequest("/api/collections");
    return Array.isArray(payload.collections)
      ? payload.collections.map(normalizeStoredModel).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function mergeModelCollections(localModels, remoteModels) {
  const byId = new Map();
  [...localModels, ...remoteModels].forEach((model) => {
    const existing = byId.get(model.id);
    if (!existing || Number(model.updatedAt || 0) >= Number(existing.updatedAt || 0)) {
      byId.set(model.id, model);
    }
  });
  return [...byId.values()];
}

function mergeSeedCollections(stored) {
  const byId = new Map(stored.map((model) => [model.id, model]));
  seedCollections.forEach((seed) => {
    if (byId.has(seed.id)) return;
    byId.set(seed.id, normalizeStoredModel({
      id: seed.id,
      name: seed.name,
      category: seed.category,
      access: seed.access,
      description: seed.description,
      scadSource: sampleScad,
      params: { ...structuredClone(defaultParams), ...seed.params },
      lensMode: "none",
      thumbnail: "",
      order: seed.order || 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));
  });
  return [...byId.values()].sort((a, b) => {
    const categoryOrder = categoryRank(a.category) - categoryRank(b.category);
    if (categoryOrder) return categoryOrder;
    const order = Number(a.order || 0) - Number(b.order || 0);
    if (order) return order;
    return a.createdAt - b.createdAt;
  });
}

function categoryRank(category) {
  return category === "sun" ? 0 : 1;
}

function normalizeStoredModel(model) {
  if (!model || typeof model !== "object") return null;
  const name = String(model.name || "Model OpenSCAD").trim() || "Model OpenSCAD";
  const category = model.category === "optical" ? "optical" : "sun";
  const access = ["free", "basic", "pro", "studio"].includes(model.access) ? model.access : "basic";
  const description = String(model.description || "").trim();
  const scadSource = String(model.scadSource || sampleScad);
  const params = { ...structuredClone(defaultParams), ...(model.params || parseScadParameters(scadSource)) };
  return {
    id: String(model.id || crypto.randomUUID()),
    name,
    category,
    access,
    description,
    scadSource,
    params,
    design: model.design && typeof model.design === "object" ? normalizeDesignStyle(model.design) : null,
    lensMode: validLensMode(model.lensMode),
    thumbnail: typeof model.thumbnail === "string" ? model.thumbnail : "",
    components: normalizeModelComponents(model.components),
    assembly: model.assembly && typeof model.assembly === "object" ? model.assembly : null,
    order: Number.isFinite(Number(model.order)) ? Number(model.order) : 0,
    createdAt: Number(model.createdAt) || Date.now(),
    updatedAt: Number(model.updatedAt) || Date.now()
  };
}

function persistModels(options = {}) {
  localStorage.setItem(modelStorageKey, JSON.stringify(state.models));
  if (options.syncBackend !== false) scheduleCollectionsBackendSync();
}

function scheduleCollectionsBackendSync() {
  if (!isDeveloper() || !sessionToken()) return;
  clearTimeout(backendPersistTimer);
  backendPersistTimer = setTimeout(() => {
    syncCollectionsToBackend().catch((error) => log(error.message || "Could not save collections to backend."));
  }, 800);
}

async function syncCollectionsToBackend(options = {}) {
  if (!isDeveloper() || !sessionToken()) return false;
  await apiRequest("/api/collections", {
    method: "PUT",
    body: JSON.stringify({ collections: state.models })
  });
  if (options.announce) log("Developer changes saved to backend.");
  return true;
}

function currentModelRecord() {
  return state.models.find((model) => model.id === state.activeModelId);
}

function activeEditableModelRecord() {
  return state.models.find((model) => model.id === state.editingModelId) || currentModelRecord();
}

function selectModel(id, options = {}) {
  const { rebuildControls = true, renderScene = true, logSelection = true, captureThumbnail = false } = options;
  const model = state.models.find((item) => item.id === id) || state.models[0] || createDefaultModel();
  if (!state.models.includes(model)) state.models.unshift(model);
  if (state.activeModelId !== model.id) {
    state.openComponentOptions = { front: true };
  }
  closeColorPickerEditor({ rebuild: false });
  state.activeModelId = model.id;
  state.modelName = model.name;
  state.scadSource = model.scadSource;
  state.params = { ...structuredClone(defaultParams), ...model.params };
  state.activeParametricDesign = model.design ? normalizeDesignStyle(model.design) : null;
  rebuildComponentLibrary();
  repairAssemblyForActiveModel(model);
  applyAssemblyToParams();
  state.lensMode = selectedLens() ? "component" : "none";
  state.meshObject = null;
  state.previewMode = "parametric";
  if (rebuildControls) {
    buildBuilderControls();
    buildControls();
  }
  updateGeneratedSource();
  if (renderScene) {
    render();
    if (captureThumbnail) queueThumbnailCapture();
  }
  renderGallery();
  if (logSelection) log(`Loaded model: ${model.name}.`);
}

function syncActiveModel(options = {}) {
  const { persist = true, thumbnail = null } = options;
  const model = currentModelRecord();
  if (!model) return;
  model.name = state.modelName;
  model.params = { ...state.params };
  model.scadSource = generateScadSource();
  model.lensMode = selectedLens() ? "component" : "none";
  model.assembly = serializeAssemblySelection();
  model.updatedAt = Date.now();
  if (thumbnail !== null) model.thumbnail = thumbnail;
  if (persist) {
    persistModels();
    renderGallery();
  }
}

function scheduleModelPersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    syncActiveModel();
  }, 350);
}

function setActiveSection(section) {
  if (section === "studio") section = "developer";
  if (section === "developer" && !isDeveloper()) section = "home";
  if (section === "collection-editor" && !isDeveloper()) section = "home";
  if (section === "licenses" && !isDeveloper()) section = "home";
  const showEditor = section === "configurator";
  const showDesignLab = section === "design-lab";
  const showStudio = section === "developer";
  const showCollectionEditor = section === "collection-editor";
  const showLicenses = section === "licenses";
  els.homePage.hidden = showEditor || showDesignLab || showStudio || showCollectionEditor || showLicenses;
  els.workspace.hidden = !showEditor;
  els.designLab.hidden = !showDesignLab;
  els.studioPanel.hidden = !showStudio || !isDeveloper();
  els.collectionEditorPanel.hidden = !showCollectionEditor || !isDeveloper();
  els.licensePanel.hidden = !showLicenses || !isDeveloper();
  if (section === "home") {
    setActiveHomeLink("#top");
  } else {
    document.querySelectorAll(".topbar-tabs .nav-link").forEach((link) => link.classList.remove("active"));
    els.openStudio.classList.toggle("active", (showStudio || showCollectionEditor) && isDeveloper());
    els.openLicenses.classList.toggle("active", showLicenses && isDeveloper());
    els.openDesignLab?.classList.toggle("active", showDesignLab);
  }
  if (showEditor) {
    resize();
    render();
  }
  if (showDesignLab) {
    requestAnimationFrame(() => {
      resizeDesignScene();
      renderDesignPreview({ fitView: true });
      loadMyDesignSubmissions();
    });
  }
  if (showStudio) {
    loadDesignSubmissions();
  }
  return section;
}

function homeNavigationEntries() {
  return [
    { selector: "#top", element: document.querySelector(".hero-page"), link: els.openHome },
    { selector: "#galleryPanel", element: els.galleryPanel, link: els.openGallery },
    { selector: "#sizeGuidePanel", element: document.querySelector("#sizeGuidePanel"), link: els.openSizes },
    { selector: "#printGuidePanel", element: document.querySelector("#printGuidePanel"), link: els.openPrintGuide },
    { selector: "#roadmapPanel", element: document.querySelector("#roadmapPanel"), link: els.openRoadmap },
    { selector: "#licenseInfoPanel", element: document.querySelector("#licenseInfoPanel"), link: els.openLicenseInfo },
    { selector: "#faqPanel", element: document.querySelector("#faqPanel"), link: els.openFaq }
  ].filter((entry) => entry.element && entry.link);
}

function setActiveHomeLink(selector) {
  document.querySelectorAll(".topbar-tabs .nav-link").forEach((link) => link.classList.remove("active"));
  const entry = homeNavigationEntries().find((item) => item.selector === selector);
  (entry?.link || els.openHome).classList.add("active");
}

function routeForView(section) {
  return {
    configurator: "#configurator",
    "design-lab": "#design-lab",
    developer: "#developer",
    "collection-editor": "#frame-editor",
    licenses: "#codes"
  }[section] || "#top";
}

function updateNavigationHistory(hash, options = {}) {
  if (window.location.hash === hash && !options.replace) return;
  const method = options.replace ? "replaceState" : "pushState";
  window.history[method]({ frameLabRoute: hash }, "", hash);
}

function navigateToView(section, options = {}) {
  const activeSection = setActiveSection(section);
  updateNavigationHistory(routeForView(activeSection), options);
  if (activeSection !== "home") window.scrollTo({ top: 0, behavior: "auto" });
}

function scrollGalleryIntoView(options = {}) {
  scrollHomeSection("#galleryPanel", options);
}

function scrollHomeSection(selector, options = {}) {
  const targetSelector = homeNavigationEntries().some((entry) => entry.selector === selector) ? selector : "#top";
  setActiveSection("home");
  setActiveHomeLink(targetSelector);
  if (options.history !== false) updateNavigationHistory(targetSelector, { replace: options.replace });
  const target = targetSelector === "#top" ? document.querySelector(".hero-page") : document.querySelector(targetSelector);
  scrollToPageTarget(target, options.behavior || "smooth");
}

function scrollToPageTarget(target, behavior = "smooth") {
  if (!target) return;
  const topbarOffset = (els.topbar?.offsetHeight || 72) + 10;
  target.style.scrollMarginTop = `${topbarOffset}px`;
  target.scrollIntoView({ behavior, block: "start" });
}

function goHome() {
  scrollHomeSection("#top");
}

function syncActiveHomeSection() {
  if (els.homePage.hidden) return;
  const entries = homeNavigationEntries();
  const marker = (els.topbar?.offsetHeight || 72) + Math.min(window.innerHeight * 0.22, 180);
  let active = entries[0];
  entries.forEach((entry) => {
    if (entry.element.getBoundingClientRect().top <= marker) active = entry;
  });
  if (active) setActiveHomeLink(active.selector);
}

function restoreNavigationRoute() {
  if (els.imageLightbox && !els.imageLightbox.hidden) closePrintGuideLightbox({ restoreFocus: false });
  const viewSections = {
    "#configurator": "configurator",
    "#design-lab": "design-lab",
    "#developer": "developer",
    "#frame-editor": "collection-editor",
    "#codes": "licenses"
  };
  const view = viewSections[window.location.hash];
  if (view) {
    const activeSection = setActiveSection(view);
    if (activeSection !== view) updateNavigationHistory("#top", { replace: true });
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }
  const selector = homeNavigationEntries().some((entry) => entry.selector === window.location.hash)
    ? window.location.hash
    : "#top";
  if (selector === "#top" && window.location.hash !== selector) updateNavigationHistory(selector, { replace: true });
  scrollHomeSection(selector, { history: false, behavior: "auto" });
}

function setupNavigation() {
  const initialHash = window.location.hash || "#top";
  updateNavigationHistory(initialHash, { replace: true });
  window.addEventListener("popstate", restoreNavigationRoute);
  window.addEventListener("scroll", () => {
    if (navigationScrollFrame !== null) return;
    navigationScrollFrame = requestAnimationFrame(() => {
      navigationScrollFrame = null;
      syncActiveHomeSection();
    });
  }, { passive: true });
  restoreNavigationRoute();
}

function openPrintGuideLightbox() {
  if (!els.imageLightbox || !els.printGuideImage?.src || els.printGuideFigure?.hidden) return;
  els.lightboxImage.src = els.printGuideImage.src;
  els.imageLightbox.hidden = false;
  document.body.classList.add("lightbox-open");
  els.closeImageLightbox?.focus();
}

function closePrintGuideLightbox(options = {}) {
  if (!els.imageLightbox || els.imageLightbox.hidden) return;
  els.imageLightbox.hidden = true;
  document.body.classList.remove("lightbox-open");
  if (options.restoreFocus !== false) els.openPrintGuideImage?.focus();
}

async function handleHeroImageSelect() {
  const file = els.heroImageInput?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    if (els.brandSettingsNote) els.brandSettingsNote.textContent = "Choose an image file for the hero.";
    return;
  }
  state.brandSettings.heroImage = await readFileAsDataUrl(file);
  applyBrandSettings();
  if (els.brandSettingsNote) els.brandSettingsNote.textContent = "Previewing hero image. Save to publish it.";
}

async function handlePrintGuideImageSelect(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    if (els.brandSettingsNote) els.brandSettingsNote.textContent = "Choose an image file for the print guide.";
    return;
  }
  state.brandSettings.content = normalizeContentSettings({
    ...state.brandSettings.content,
    printGuide: {
      ...state.brandSettings.content.printGuide,
      image: await readFileAsDataUrl(file)
    }
  });
  applyBrandSettings();
  if (els.brandSettingsNote) els.brandSettingsNote.textContent = "Previewing print guide image. Save to publish it.";
}

function sessionToken() {
  return localStorage.getItem(sessionStorageKey) || "";
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const token = sessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Backend request failed.");
  return payload;
}

function accountFromUser(user) {
  if (!user) return { email: "", firstName: "", lastName: "", plan: "free", role: "visitor", subscriptionMode: "free", subscriptionStatus: "none", planEndsAt: null, measurements: sanitizeMeasurements({}) };
  return {
    email: String(user.email || "").toLowerCase(),
    firstName: String(user.firstName || ""),
    lastName: String(user.lastName || ""),
    plan: validAccountPlan(user.plan) ? user.plan : "free",
    role: user.role === "developer" ? "developer" : "customer",
    subscriptionMode: user.subscriptionMode || "free",
    subscriptionStatus: user.subscriptionStatus || "none",
    planEndsAt: user.planEndsAt || null,
    measurements: sanitizeMeasurements(user.measurements || {})
  };
}

function sanitizeMeasurements(measurements = {}) {
  const numeric = (value, min, max) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : null;
  };
  return {
    headWidth: numeric(measurements.headWidth, 90, 220),
    bridgeWidth: numeric(measurements.bridgeWidth, 8, 34),
    templeLength: numeric(measurements.templeLength, 100, 190),
    updatedAt: measurements.updatedAt || null
  };
}

async function hydrateSessionFromBackend() {
  if (!sessionToken()) return false;
  try {
    const payload = await apiRequest("/api/session");
    state.account = accountFromUser(payload.user);
    await Promise.all([loadDownloadQuota({ silent: true }), loadDownloadFolder({ silent: true })]);
    if (isDeveloper()) await Promise.all([loadStaticLicenseCodes({ silent: true }), loadLicenseCodes({ silent: true })]);
    persistActiveAccount({ skipProfile: true });
    return true;
  } catch {
    localStorage.removeItem(sessionStorageKey);
    localStorage.removeItem(accountStorageKey);
    state.account = accountFromUser(null);
    state.downloadQuota = null;
    return false;
  }
}

function isDeveloper() {
  return state.account.role === "developer";
}

function isAdminEmail(email) {
  return adminEmails.has(String(email || "").toLowerCase());
}

function validAccountPlan(plan) {
  return Object.prototype.hasOwnProperty.call(planRank, plan);
}

function modelAccessPlan(access) {
  if (access === "studio") return "studio";
  if (access === "pro") return "pro";
  return "basic";
}

function canAccessModel(model) {
  if (isDeveloper()) return true;
  return planRank[state.account.plan] >= planRank[modelAccessPlan(model?.access)];
}

function accessLabel(access) {
  return planLabel(modelAccessPlan(access));
}

function planLabel(plan) {
  if (plan === "studio") return "Plus";
  if (plan === "pro") return "Pro";
  if (plan === "basic") return "Basic";
  return "No plan";
}

function validLensMode(value) {
  return value === "component" ? "component" : "none";
}

function selectedLensLabel() {
  return selectedLens()?.name || "No lenses";
}

function lensModeLabel() {
  return selectedLensLabel();
}

function accountLabel() {
  if (isDeveloper()) return "Developer";
  if (state.account.role === "visitor" || !state.account.email) return "Login";
  return "Account";
}

function openPlansPanel(message = "") {
  if (els.plansContext) {
    els.plansContext.textContent = message;
    els.plansContext.hidden = !message;
  }
  els.plansPanel.hidden = false;
}

function setAuthMode(mode) {
  state.authMode = mode === "register" ? "register" : "login";
  const isRegister = state.authMode === "register";
  els.authModeButtons.forEach((button) => button.classList.toggle("active", button.dataset.authMode === state.authMode));
  els.nameFields.hidden = !isRegister;
  els.confirmPasswordField.hidden = !isRegister;
  els.authTitle.textContent = isRegister ? "Create account" : "Login";
  els.signInAccount.textContent = isRegister ? "Create account" : "Login";
  els.accountPassword.autocomplete = isRegister ? "new-password" : "current-password";
  els.accountNote.textContent = "";
}

function togglePasswordVisibility(button) {
  const input = document.querySelector(`#${button.dataset.passwordToggle}`);
  if (!input) return;
  const visible = input.type === "text";
  input.type = visible ? "password" : "text";
  button.textContent = visible ? "Show" : "Hide";
}

function updateAccountUi() {
  if (!els.accountButton) return;
  const signedIn = state.account.role !== "visitor" && Boolean(state.account.email);
  els.accountButton.textContent = accountLabel();
  els.accountButton.classList.toggle("developer", isDeveloper());
  els.openStudio.hidden = !isDeveloper();
  els.openLicenses.hidden = !isDeveloper();
  els.studioPanel.hidden = els.studioPanel.hidden || !isDeveloper();
  els.collectionEditorPanel.hidden = els.collectionEditorPanel.hidden || !isDeveloper();
  els.licensePanel.hidden = els.licensePanel.hidden || !isDeveloper();
  els.accountEmail.value = state.account.email;
  els.authForm.hidden = signedIn;
  els.accountProfile.hidden = !signedIn;
  els.cancelSubscription.hidden = true;
  if (!signedIn) setAuthMode(state.authMode);
  if (signedIn) {
    els.profileEmail.textContent = state.account.email;
    els.profileName.textContent = [state.account.firstName, state.account.lastName].filter(Boolean).join(" ") || "Customer";
    els.profileRole.textContent = isDeveloper() ? "Developer account" : "Customer account";
    els.profilePlan.textContent = planLabel(state.account.plan);
    els.profileStatus.textContent = subscriptionStatusLabel();
    if (els.profileExports) els.profileExports.textContent = downloadQuotaLabel();
    syncFitProfileUi();
    els.cancelSubscription.hidden = isDeveloper() || state.account.subscriptionMode !== "subscription";
    els.cancelSubscription.disabled = state.account.subscriptionStatus !== "active";
  }
  els.planButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.plan === state.account.plan);
    button.disabled = isDeveloper() && button.dataset.plan !== "studio";
  });
  els.accountNote.textContent = isDeveloper()
    ? t("accountDeveloperNote")
    : state.account.plan === "studio"
      ? t("accountPlusNote")
      : state.account.plan === "pro"
        ? t("accountProNote")
        : state.account.plan === "basic"
          ? t("accountBasicNote")
          : t("accountFreeNote");
  renderPlanCards();
  document.querySelectorAll("button[data-plan-pick]").forEach((button) => {
    const picked = button.dataset.planPick === state.account.plan;
    button.textContent = picked ? "Current plan" : "Enter code";
    button.classList.toggle("accent", !picked && button.dataset.planPick === "pro");
  });
  renderStorageStatus();
  renderDownloadFolder();
  renderStaticLicenseCodeList();
  renderLicenseCodeList();
  renderContentEditors();
  renderGallery();
}

function renderDownloadFolder() {
  if (!els.downloadFolder) return;
  if (els.profileExports) els.profileExports.textContent = downloadQuotaLabel();
  const signedIn = state.account.role !== "visitor" && Boolean(state.account.email);
  if (!signedIn) {
    els.downloadFolder.innerHTML = "";
    return;
  }
  if (!state.downloads.length) {
    els.downloadFolder.innerHTML = `
      <div class="download-empty">
        <strong>No downloaded configurations yet.</strong>
        <small>Your exported 3MF setups will appear here.</small>
      </div>
    `;
    return;
  }
  els.downloadFolder.innerHTML = state.downloads.slice(0, 12).map((item) => {
    const parameters = item.configuration?.parameters || {};
    const chips = [
      ["Head", parameters.head_width, "mm"],
      ["Bridge", parameters.bridge_width, "mm"],
      ["Temples", parameters.temple_length, "mm"]
    ].filter(([, value]) => Number.isFinite(Number(value))).map(([label, value, unit]) => `
      <span>${label} ${formatNumber(value)}${unit}</span>
    `).join("");
    return `
      <article class="download-item">
        <div>
          <strong>${escapeHtml(item.modelName)}</strong>
          <small>${escapeHtml(item.fileName)} · ${downloadDateLabel(item.createdAt)}</small>
        </div>
        <div class="download-tags">
          <span>${escapeHtml(accessLabel(item.plan))}</span>
          <span>${escapeHtml(downloadLensLabel(item))}</span>
          ${chips}
        </div>
      </article>
    `;
  }).join("");
}

function downloadLensLabel(item) {
  const configurationLens = item.configuration?.lens;
  if (configurationLens?.mode === "component" && configurationLens.label) return configurationLens.label;
  if (item.lensMode === "component" && item.lensLabel) return item.lensLabel;
  return "No lenses";
}

function downloadQuotaLabel() {
  if (isDeveloper()) return "Unlimited";
  if (state.account.role === "visitor" || !state.account.email) return "Plan required";
  if (state.account.plan === "free") return "Plan required";
  if (!state.downloadQuota) return "Loading";
  if (state.downloadQuota.limit === null) return "Unlimited";
  return `${state.downloadQuota.used} / ${state.downloadQuota.limit} this month`;
}

function syncFitProfileUi() {
  const measurements = sanitizeMeasurements(state.account.measurements || {});
  if (els.accountHeadWidth) els.accountHeadWidth.value = measurements.headWidth || "";
  if (els.accountBridgeWidth) els.accountBridgeWidth.value = measurements.bridgeWidth || "";
  if (els.accountTempleLength) els.accountTempleLength.value = measurements.templeLength || "";
  renderFitRecommendation();
}

function recommendedSize(measurements = state.account.measurements) {
  const fit = sanitizeMeasurements(measurements || {});
  const rows = normalizeContentSettings(state.brandSettings.content).sizes.rows;
  if (!fit.headWidth && !fit.bridgeWidth && !fit.templeLength) return null;
  const scoreValue = (value, min, max) => {
    if (!Number.isFinite(Number(value))) return 0;
    if (value >= min && value <= max) return 3;
    const distance = value < min ? min - value : value - max;
    if (distance <= 3) return 1.4;
    if (distance <= 7) return 0.5;
    return -1;
  };
  const ranked = rows.map((row) => ({
    row,
    score:
      scoreValue(fit.headWidth, row.headMin, row.headMax) * 1.25 +
      scoreValue(fit.bridgeWidth, row.bridgeMin, row.bridgeMax) +
      scoreValue(fit.templeLength, row.templeMin, row.templeMax)
  })).sort((a, b) => b.score - a.score);
  return ranked[0]?.row || null;
}

function renderFitRecommendation() {
  if (!els.fitRecommendation) return;
  const suggestion = recommendedSize();
  els.fitRecommendation.textContent = suggestion
    ? `Recommended size: ${suggestion.size} (${suggestion.label}).`
    : "Add your measurements to get a size recommendation.";
}

async function saveFitProfile() {
  if (state.account.role === "visitor" || !sessionToken()) {
    els.accountNote.textContent = "Login first to save your fit profile.";
    return;
  }
  const measurements = sanitizeMeasurements({
    headWidth: els.accountHeadWidth?.value,
    bridgeWidth: els.accountBridgeWidth?.value,
    templeLength: els.accountTempleLength?.value
  });
  try {
    els.saveFitProfile.disabled = true;
    const payload = await apiRequest("/api/account/measurements", {
      method: "PUT",
      body: JSON.stringify({ measurements })
    });
    state.account = accountFromUser(payload.user);
    persistActiveAccount();
    syncFitProfileUi();
    log("Fit profile saved.");
  } catch (error) {
    if (els.fitRecommendation) els.fitRecommendation.textContent = error.message || "Could not save fit profile.";
  } finally {
    els.saveFitProfile.disabled = false;
  }
}

function downloadDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function loadDownloadFolder(options = {}) {
  if (!sessionToken() || state.account.role === "visitor") {
    state.downloads = [];
    renderDownloadFolder();
    return false;
  }
  try {
    const payload = await apiRequest("/api/downloads");
    state.downloads = Array.isArray(payload.downloads) ? payload.downloads : [];
    renderDownloadFolder();
    return true;
  } catch (error) {
    state.downloads = [];
    renderDownloadFolder();
    if (!options.silent) log(error.message || "Could not load download folder.");
    return false;
  }
}

async function loadDownloadQuota(options = {}) {
  if (!sessionToken() || state.account.role === "visitor") {
    state.downloadQuota = null;
    renderDownloadFolder();
    return false;
  }
  try {
    const payload = await apiRequest("/api/download-quota");
    state.downloadQuota = payload.quota || null;
    renderDownloadFolder();
    return true;
  } catch (error) {
    state.downloadQuota = null;
    renderDownloadFolder();
    if (!options.silent) log(error.message || "Could not load download quota.");
    return false;
  }
}

function normalizeLicenseCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 12);
}

function formatLicenseCode(value) {
  const digits = normalizeLicenseCode(value);
  return [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8, 12)].filter(Boolean).join("-");
}

async function redeemLicenseCode() {
  const code = normalizeLicenseCode(els.licenseCodeInput.value);
  if (code.length !== 12) {
    els.licenseCodeNote.textContent = "Enter a 12 digit activation code.";
    return;
  }
  try {
    els.redeemLicenseCode.disabled = true;
    els.licenseCodeNote.textContent = "Activating code...";
    const payload = await apiRequest("/api/license-codes/redeem", {
      method: "POST",
      body: JSON.stringify({ code })
    });
    state.account = accountFromUser(payload.user);
    persistActiveAccount();
    els.licenseCodeInput.value = "";
    els.licenseCodeNote.textContent = payload.message || "Code activated.";
    await loadDownloadQuota({ silent: true });
    if (isDeveloper()) await Promise.all([loadStaticLicenseCodes({ silent: true }), loadLicenseCodes({ silent: true })]);
    updateAccountUi();
    log(payload.message || "Activation code applied.");
  } catch (error) {
    els.licenseCodeNote.textContent = error.message || "Could not activate code.";
  } finally {
    els.redeemLicenseCode.disabled = false;
  }
}

async function loadLicenseCodes(options = {}) {
  if (!isDeveloper() || !sessionToken()) {
    state.licenseCodes = [];
    renderLicenseCodeList();
    return false;
  }
  try {
    const payload = await apiRequest("/api/license-codes");
    state.licenseCodes = Array.isArray(payload.codes) ? payload.codes : [];
    renderLicenseCodeList();
    return true;
  } catch (error) {
    state.licenseCodes = [];
    renderLicenseCodeList();
    if (!options.silent && els.licenseAdminNote) els.licenseAdminNote.textContent = error.message || "Could not load license codes.";
    return false;
  }
}

async function loadStaticLicenseCodes(options = {}) {
  if (!isDeveloper() || !sessionToken()) {
    state.staticLicenseCodes = [];
    renderStaticLicenseCodeList();
    return false;
  }
  try {
    const payload = await apiRequest("/api/static-license-codes");
    state.staticLicenseCodes = Array.isArray(payload.codes) ? payload.codes : [];
    renderStaticLicenseCodeList();
    return true;
  } catch (error) {
    state.staticLicenseCodes = [];
    renderStaticLicenseCodeList();
    if (!options.silent && els.licenseAdminNote) els.licenseAdminNote.textContent = error.message || "Could not load static codes.";
    return false;
  }
}

async function generateLicenseCodes() {
  if (!isDeveloper()) return;
  const type = licenseCodeTypes[els.licenseCodeType.value] ? els.licenseCodeType.value : "pro_month";
  const quantity = Math.min(50, Math.max(1, Number(els.licenseCodeQuantity.value) || 1));
  try {
    els.generateLicenseCodes.disabled = true;
    els.licenseAdminNote.textContent = "Generating codes...";
    const payload = await apiRequest("/api/license-codes", {
      method: "POST",
      body: JSON.stringify({ type, quantity })
    });
    const created = Array.isArray(payload.codes) ? payload.codes : [];
    state.licenseCodes = [...created, ...state.licenseCodes].slice(0, 500);
    renderLicenseCodeList();
    els.licenseAdminNote.textContent = `Generated ${created.length} ${licenseCodeTypes[type].label} code${created.length === 1 ? "" : "s"}.`;
  } catch (error) {
    els.licenseAdminNote.textContent = error.message || "Could not generate codes.";
  } finally {
    els.generateLicenseCodes.disabled = false;
  }
}

function renderStaticLicenseCodeList() {
  if (!els.staticLicenseCodeList) return;
  if (!isDeveloper()) {
    els.staticLicenseCodeList.innerHTML = "";
    return;
  }
  if (!state.staticLicenseCodes.length) {
    els.staticLicenseCodeList.innerHTML = `
      <div class="download-empty">
        <strong>No reusable codes configured.</strong>
        <small>The backend should expose one fixed code for each plan.</small>
      </div>
    `;
    return;
  }
  els.staticLicenseCodeList.innerHTML = state.staticLicenseCodes.map((item) => {
    const type = licenseCodeTypes[item.type] || licenseCodeTypes.plus_lifetime;
    return `
      <article class="license-code-item reusable">
        <div>
          <code>${escapeHtml(item.code)}</code>
          <small>${escapeHtml(item.label || type.label)} · fixed reusable access</small>
        </div>
        <div class="license-code-meta">
          <span>Reusable</span>
          <small>${escapeHtml(planLabel(type.plan))} · ${escapeHtml(licenseDurationLabel(type.duration))}</small>
        </div>
      </article>
    `;
  }).join("");
}

function licenseDurationLabel(duration) {
  if (duration === "lifetime") return "Lifetime";
  if (duration === "year") return "Yearly";
  return "Monthly";
}

function renderLicenseCodeList() {
  if (!els.licenseCodeList) return;
  if (!isDeveloper()) {
    els.licenseCodeList.innerHTML = "";
    return;
  }
  if (!state.licenseCodes.length) {
    els.licenseCodeList.innerHTML = `
      <div class="download-empty">
        <strong>No activation codes yet.</strong>
        <small>Generate a monthly or lifetime code to share with a customer.</small>
      </div>
    `;
    return;
  }
  els.licenseCodeList.innerHTML = state.licenseCodes.slice(0, 160).map((item) => {
    const type = licenseCodeTypes[item.type] || licenseCodeTypes.pro_month;
    const redeemed = item.status === "redeemed";
    return `
      <article class="license-code-item ${redeemed ? "redeemed" : "active"}">
        <div>
          <code>${escapeHtml(item.code)}</code>
          <small>${escapeHtml(type.label)} · ${licenseDateLabel(item.createdAt)}</small>
        </div>
        <div class="license-code-meta">
          <span>${redeemed ? "Redeemed" : "Active"}</span>
          ${redeemed ? `<small>${escapeHtml(item.redeemedByEmail || "used")} · ${licenseDateLabel(item.redeemedAt)}</small>` : "<small>Ready to share</small>"}
        </div>
      </article>
    `;
  }).join("");
}

function licenseDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "no date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function subscriptionStatusLabel() {
  if (isDeveloper()) return "Developer access";
  const ends = state.account.planEndsAt ? new Date(state.account.planEndsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  if (state.account.subscriptionStatus === "lifetime") return "Lifetime access";
  if (state.account.subscriptionStatus === "active") return ends ? `Subscription active until ${ends}` : "Subscription active";
  if (state.account.subscriptionStatus === "cancel_at_period_end") return ends ? `Cancels on ${ends}` : "Cancelling";
  if (state.account.subscriptionMode === "license_month") return ends ? `Code access until ${ends}` : "Code access";
  if (state.account.subscriptionStatus === "paid_once") return ends ? `One-month access until ${ends}` : "One-month access";
  return state.account.plan === "free" ? "No active plan" : "Active";
}

async function signInAccount() {
  const email = els.accountEmail.value.trim().toLowerCase();
  const password = els.accountPassword.value;
  const passwordConfirm = els.accountPasswordConfirm.value;
  const firstName = els.accountFirstName.value.trim();
  const lastName = els.accountLastName.value.trim();
  if (!email || !password) {
    els.accountNote.textContent = "Enter email and password to continue.";
    return;
  }
  if (state.authMode === "register") {
    if (!firstName || !lastName) {
      els.accountNote.textContent = "Enter first and last name.";
      return;
    }
    if (password.length < 6) {
      els.accountNote.textContent = "Password must have at least 6 characters.";
      return;
    }
    if (password !== passwordConfirm) {
      els.accountNote.textContent = "Passwords do not match.";
      return;
    }
  }
  try {
    els.accountNote.textContent = "Connecting to Frame Lab backend...";
    const payload = await apiRequest("/api/auth/email", {
      method: "POST",
      body: JSON.stringify({ email, password, mode: state.authMode, firstName, lastName })
    });
    localStorage.setItem(sessionStorageKey, payload.token);
    state.account = accountFromUser(payload.user);
    await Promise.all([loadDownloadQuota({ silent: true }), loadDownloadFolder({ silent: true })]);
    if (isDeveloper()) await loadLicenseCodes({ silent: true });
  } catch (error) {
    els.accountNote.textContent = error.message || "Could not sign in.";
    return;
  }
  persistActiveAccount();
  updateAccountUi();
  els.accountPassword.value = "";
  els.accountPasswordConfirm.value = "";
  els.accountPanel.hidden = true;
  if (!isDeveloper()) openPlansPanel();
  log(`${email || "account"}: ${accountLabel()}.`);
}

async function signOutAccount() {
  try {
    if (sessionToken()) await apiRequest("/api/auth/sign-out", { method: "POST" });
  } catch {
    // Local logout should still complete if the session expired server-side.
  }
  localStorage.removeItem(sessionStorageKey);
  state.account = accountFromUser(null);
  state.downloads = [];
  state.downloadQuota = null;
  state.licenseCodes = [];
  state.staticLicenseCodes = [];
  persistActiveAccount();
  els.plansPanel.hidden = true;
  els.accountPanel.hidden = true;
  els.accountPassword.value = "";
  els.accountPasswordConfirm.value = "";
  els.accountFirstName.value = "";
  els.accountLastName.value = "";
  goHome();
  updateAccountUi();
  log("Signed out.");
}

function openLicenseActivation(plan) {
  state.pendingPlan = ["basic", "pro", "studio"].includes(plan) ? plan : "basic";
  els.plansPanel.hidden = true;
  els.accountPanel.hidden = false;
  updateAccountUi();
  if (state.account.role === "visitor" || !state.account.email) {
    els.accountNote.textContent = `Create an account, then activate ${planLabel(state.pendingPlan)} with a 12-digit code.`;
    els.accountEmail.focus();
    return;
  }
  els.licenseCodeNote.textContent = `Enter a ${planLabel(state.pendingPlan)} activation code.`;
  els.licenseCodeInput.focus();
}

async function cancelSubscription() {
  if (state.account.subscriptionMode !== "subscription") return;
  try {
    const payload = await apiRequest("/api/subscription/cancel", { method: "POST" });
    state.account = accountFromUser(payload.user);
    persistActiveAccount();
    updateAccountUi();
    log(payload.message || "Subscription cancellation scheduled.");
  } catch (error) {
    log(error.message || "Could not cancel subscription.");
  }
}

async function startOauth(provider) {
  try {
    const payload = await apiRequest(`/api/auth/oauth/${provider}`);
    if (payload.url) window.location.href = payload.url;
  } catch (error) {
    els.accountNote.textContent = "Google login needs provider credentials before it can go live.";
  }
}

function accountProfile(email) {
  return accountProfiles()[String(email || "").toLowerCase()] || null;
}

function accountProfiles() {
  try {
    const parsed = JSON.parse(localStorage.getItem(accountProfilesStorageKey) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function upsertAccountProfile(account) {
  const email = String(account.email || "").toLowerCase();
  const profiles = accountProfiles();
  const existing = profiles[email] || {};
  const profile = {
    email,
    firstName: String(account.firstName || existing.firstName || ""),
    lastName: String(account.lastName || existing.lastName || ""),
    role: isAdminEmail(email) ? "developer" : (account.role === "developer" ? "developer" : "customer"),
    plan: isAdminEmail(email) ? "studio" : (validAccountPlan(account.plan) ? account.plan : "free"),
    subscriptionMode: account.subscriptionMode || existing.subscriptionMode || "free",
    subscriptionStatus: account.subscriptionStatus || existing.subscriptionStatus || "none",
    planEndsAt: account.planEndsAt || existing.planEndsAt || null,
    measurements: sanitizeMeasurements(account.measurements || existing.measurements || {}),
    createdAt: existing.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  profiles[email] = profile;
  localStorage.setItem(accountProfilesStorageKey, JSON.stringify(profiles));
  return {
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    role: profile.role,
    plan: profile.plan,
    subscriptionMode: profile.subscriptionMode,
    subscriptionStatus: profile.subscriptionStatus,
    planEndsAt: profile.planEndsAt,
    measurements: sanitizeMeasurements(profile.measurements || {})
  };
}

function persistActiveAccount(options = {}) {
  localStorage.setItem(accountStorageKey, JSON.stringify(state.account));
  if (state.account.email && !options.skipProfile) upsertAccountProfile(state.account);
}

function renderGallery() {
  if (!els.sunGalleryGrid) return;
  els.sunGalleryGrid.classList.remove("gallery-grid-loading");
  els.sunGalleryGrid.removeAttribute("aria-busy");
  els.sunGalleryGrid.removeAttribute("aria-label");
  els.sunGalleryGrid.innerHTML = "";
  if (els.opticalGalleryGrid) els.opticalGalleryGrid.innerHTML = "";
  galleryModels().forEach((model, index) => {
    const card = document.createElement("article");
    card.className = `gallery-card${model.id === state.activeModelId ? " active" : ""}`;
    card.dataset.modelId = model.id;
    const thumb = model.thumbnail
      ? `<img src="${model.thumbnail}" alt="Miniatura modelu ${escapeHtml(model.name)}" />`
      : `<span class="gallery-placeholder gallery-placeholder-${(index % 5) + 1}" aria-hidden="true"></span>`;
    const meta = model.description.trim();
    card.innerHTML = `
      <div class="gallery-thumb">${thumb}</div>
      <div class="gallery-body">
        <div class="gallery-title-row">
          <div>
            <h3>${escapeHtml(model.name)}</h3>
            ${meta ? `<div class="gallery-meta">${escapeHtml(meta)}</div>` : ""}
          </div>
          <span class="access-badge access-${modelAccessPlan(model.access)}">${accessLabel(model.access)}</span>
        </div>
        <div class="gallery-actions">
          <button type="button" class="accent" data-action="open">${t("open")}</button>
          ${isDeveloper() ? `<button type="button" data-action="edit">Edit</button>` : ""}
          ${isDeveloper() ? `<button type="button" class="compact order-button" data-action="move-left">${t("moveLeft")}</button>` : ""}
          ${isDeveloper() ? `<button type="button" class="compact order-button" data-action="move-right">${t("moveRight")}</button>` : ""}
          ${isDeveloper() && model.id !== defaultModelId ? `<button type="button" class="delete-button" data-action="delete">${t("delete")}</button>` : ""}
        </div>
      </div>
    `;
    els.sunGalleryGrid.append(card);
  });
  renderDeveloperCollectionList();
  renderHeroEditorTargetOptions();
}

function heroEditorModel() {
  const models = galleryModels();
  return models.find((model) => model.id === state.brandSettings.heroModelId) || models[0] || state.models[0] || null;
}

function renderHeroEditorTargetOptions() {
  if (!els.heroEditorTarget) return;
  const models = galleryModels();
  const selected = heroEditorModel();
  els.heroEditorTarget.innerHTML = models.length
    ? models.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.name)}</option>`).join("")
    : `<option value="">No available collections</option>`;
  els.heroEditorTarget.disabled = models.length === 0;
  els.heroEditorTarget.value = selected?.id || "";
}

function openHeroEditorTarget() {
  const model = heroEditorModel();
  if (model?.design) {
    loadPublishedDesignIntoLab(model);
    return;
  }
  if (model) selectModel(model.id);
  navigateToView("configurator");
}

function repairDeletedHeroEditorTarget(deletedModelId) {
  if (state.brandSettings.heroModelId !== deletedModelId) return;
  state.brandSettings.heroModelId = heroEditorModel()?.id || "";
  applyBrandSettings();
  saveBrandSettings();
}

function renderDeveloperCollectionList() {
  if (!els.developerCollectionList) return;
  if (!isDeveloper()) {
    els.developerCollectionList.innerHTML = "";
    return;
  }
  els.developerCollectionList.innerHTML = galleryModels().map((model) => {
    const components = normalizeModelComponents(model.components) || { front: [], temples: [], leftTemples: [], rightTemples: [], lenses: [] };
    const active = state.editingModelId === model.id;
    const summary = model.design ? "Design Lab · parametric OpenSCAD" : [
      `${components.front.length} front`,
      `${components.leftTemples.length} left temple`,
      `${components.rightTemples.length} right temple`,
      `${components.lenses.length} lens`
    ].join(" · ");
    return `
      <article class="developer-collection-row${active ? " active" : ""}" data-model-id="${escapeHtml(model.id)}">
        <div class="developer-collection-copy">
          <strong>${escapeHtml(model.name)}</strong>
          <small>${escapeHtml(model.category === "optical" ? t("opticalHeading") : t("sunHeading"))} · ${escapeHtml(accessLabel(model.access))} · ${escapeHtml(summary)}</small>
        </div>
        <div class="developer-collection-actions">
          <button type="button" class="compact${active ? " accent" : ""}" data-dev-action="edit">Edit</button>
          <button type="button" class="compact order-button" data-dev-action="move-left">${t("moveLeft")}</button>
          <button type="button" class="compact order-button" data-dev-action="move-right">${t("moveRight")}</button>
          ${model.id !== defaultModelId ? `<button type="button" class="compact delete-button" data-dev-action="delete">${t("delete")}</button>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

function galleryModels() {
  return state.models.filter((model) => model.category === "sun").sort((a, b) => {
    const categoryOrder = categoryRank(a.category) - categoryRank(b.category);
    if (categoryOrder) return categoryOrder;
    const order = Number(a.order || 0) - Number(b.order || 0);
    if (order) return order;
    return Number(a.createdAt || 0) - Number(b.createdAt || 0);
  });
}

function handleGalleryClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest(".gallery-card");
  const model = state.models.find((item) => item.id === card?.dataset.modelId);
  if (!model) return;
  if (button.dataset.action === "open") {
    if (model.design) {
      loadPublishedDesignIntoLab(model);
      return;
    }
    selectModel(model.id);
    navigateToView("configurator");
    return;
  }
  if (button.dataset.action === "export") {
    if (!canAccessModel(model)) {
      els.accountPanel.hidden = false;
      log(`${model.name}: ${t("lockedModel")} ${accessLabel(model.access)}.`);
      return;
    }
    downloadText(`${slugify(model.name)}.scad`, model.scadSource, "application/scad");
    log(`Exported ${model.name}.scad.`);
    return;
  }
  if (button.dataset.action === "edit") {
    if (!isDeveloper()) {
      log("Editing is available only in developer mode.");
      return;
    }
    startModelEdit(model);
    return;
  }
  if (button.dataset.action === "move-left" || button.dataset.action === "move-right") {
    if (!isDeveloper()) {
      log("Ordering is available only in developer mode.");
      return;
    }
    moveModelInGallery(model.id, button.dataset.action === "move-left" ? -1 : 1);
    return;
  }
  if (button.dataset.action === "delete") {
    if (!isDeveloper()) {
      log("Deletion is available only in developer mode.");
      return;
    }
    state.models = state.models.filter((item) => item.id !== model.id);
    if (state.activeModelId === model.id) selectModel(state.models[0]?.id || defaultModelId, { logSelection: false });
    normalizeGalleryOrder(model.category);
    persistModels();
    repairDeletedHeroEditorTarget(model.id);
    renderGallery();
    log(`Deleted model: ${model.name}.`);
  }
}

function handleDeveloperCollectionListClick(event) {
  const button = event.target.closest("button[data-dev-action]");
  if (!button || !isDeveloper()) return;
  const row = button.closest("[data-model-id]");
  const model = state.models.find((item) => item.id === row?.dataset.modelId);
  if (!model) return;
  if (button.dataset.devAction === "edit") {
    startModelEdit(model);
    return;
  }
  if (button.dataset.devAction === "move-left" || button.dataset.devAction === "move-right") {
    moveModelInGallery(model.id, button.dataset.devAction === "move-left" ? -1 : 1);
    return;
  }
  if (button.dataset.devAction === "delete") {
    if (model.id === defaultModelId) return;
    state.models = state.models.filter((item) => item.id !== model.id);
    if (state.editingModelId === model.id) clearCollectionForm();
    if (state.activeModelId === model.id) selectModel(state.models[0]?.id || defaultModelId, { logSelection: false });
    normalizeGalleryOrder(model.category);
    persistModels();
    repairDeletedHeroEditorTarget(model.id);
    renderGallery();
    log(`Deleted model: ${model.name}.`);
  }
}

function moveModelInGallery(modelId, direction) {
  const model = state.models.find((item) => item.id === modelId);
  if (!model) return;
  const siblings = state.models
    .filter((item) => item.category === model.category)
    .sort((a, b) => {
      const order = Number(a.order || 0) - Number(b.order || 0);
      if (order) return order;
      return Number(a.createdAt || 0) - Number(b.createdAt || 0);
    });
  const index = siblings.findIndex((item) => item.id === modelId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;
  const target = siblings[targetIndex];
  const currentOrder = Number(model.order || index);
  model.order = Number(target.order || targetIndex);
  target.order = currentOrder;
  normalizeGalleryOrder(model.category);
  persistModels();
  renderGallery();
  log(`Moved ${model.name} ${direction < 0 ? "left" : "right"} in the gallery.`);
}

function normalizeGalleryOrder(category) {
  state.models
    .filter((item) => item.category === category)
    .sort((a, b) => {
      const order = Number(a.order || 0) - Number(b.order || 0);
      if (order) return order;
      return Number(a.createdAt || 0) - Number(b.createdAt || 0);
    })
    .forEach((model, index) => {
      model.order = index;
      model.updatedAt = Date.now();
    });
}

function queueThumbnailCapture() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        renderer.render(scene, camera);
        syncActiveModel({ thumbnail: els.canvas.toDataURL("image/png") });
      } catch {
        syncActiveModel();
      }
    });
  });
}

async function handleScadImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const source = await file.text();
  const parsed = parseScadParameters(source);
  const model = {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.[^.]+$/, ""),
    scadSource: source,
    params: { ...structuredClone(defaultParams), ...parsed },
    thumbnail: "",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  state.models.unshift(model);
  persistModels();
  selectModel(model.id);
  navigateToView("configurator");
  log(`Added ${file.name}. Detected ${Object.keys(parsed).length} Frame Lab-compatible parameters.`);
  event.target.value = "";
}

async function addCollectionFromStudio() {
  const scadFile = els.galleryScadInput.files?.[0];
  const imageFile = els.collectionImageInput.files?.[0];
  const frontFiles = [...(els.collectionFrontInput.files || [])];
  const leftTempleFiles = [...(els.collectionLeftTempleInput.files || [])];
  const rightTempleFiles = [...(els.collectionRightTempleInput.files || [])];
  const lensFiles = [...(els.collectionLensInput.files || [])];
  const existing = state.editingModelId ? state.models.find((model) => model.id === state.editingModelId) : null;
  const modelId = existing?.id || crypto.randomUUID();
  const title = (els.collectionTitle.value.trim() || scadFile?.name?.replace(/\.[^.]+$/, "") || existing?.name || "New collection");
  const source = scadFile ? await scadFile.text() : sampleScad;
  const parsed = scadFile ? parseScadParameters(source) : {};
  const params = existing && !scadFile ? existing.params : { ...structuredClone(defaultParams), ...parsed };
  const thumbnail = imageFile
    ? state.croppedCollectionImage || await readFileAsDataUrl(imageFile)
    : existing?.thumbnail || makeAutoCollectionThumbnail(title, params, els.collectionCategory.value);
  const frontComponents = [];
  for (const [index, file] of frontFiles.entries()) {
    frontComponents.push(await createComponentRecordFromFile(file, "front", {
      collectionId: modelId,
      name: `${title} Front ${index + 1}`
    }));
  }
  const leftTempleComponents = [];
  for (const [index, file] of leftTempleFiles.entries()) {
    leftTempleComponents.push(await createComponentRecordFromFile(file, "temple", {
      collectionId: modelId,
      name: `${title} Left Temple ${index + 1}`,
      templeSide: "left"
    }));
  }
  const rightTempleComponents = [];
  for (const [index, file] of rightTempleFiles.entries()) {
    rightTempleComponents.push(await createComponentRecordFromFile(file, "temple", {
      collectionId: modelId,
      name: `${title} Right Temple ${index + 1}`,
      templeSide: "right"
    }));
  }
  const lensComponents = [];
  for (const [index, file] of lensFiles.entries()) {
    lensComponents.push(await createComponentRecordFromFile(file, "lens", {
      collectionId: modelId,
      name: `${title} Lens ${index + 1}`
    }));
  }
  if (frontComponents.length || leftTempleComponents.length || rightTempleComponents.length || lensComponents.length) {
    state.uploadedComponents = [...await loadSeedComponentAssets(), ...await loadComponentRecords()]
      .filter((component) => !state.hiddenComponentIds.has(component.id));
    await hydrateUploadedComponentMeshes();
  }
  const existingComponents = normalizeModelComponents(existing?.components) || { front: [], temples: [], leftTemples: [], rightTemples: [], lenses: [] };
  const assembly = existing?.assembly ? structuredClone(existing.assembly) : serializeAssemblySelection();
  if (!existing && frontComponents[0]) assembly.front = { modelId: frontComponents[0].id, size: frontComponents[0].size };
  if (!existing && leftTempleComponents[0]) assembly.leftTemple = { modelId: leftTempleComponents[0].id, size: leftTempleComponents[0].size };
  if (!existing && rightTempleComponents[0]) assembly.rightTemple = { modelId: rightTempleComponents[0].id, size: rightTempleComponents[0].size };
  if (!existing && lensComponents[0]) assembly.lens = { modelId: lensComponents[0].id, size: lensComponents[0].size };
  const initialComponent = frontComponents[0] || leftTempleComponents[0] || rightTempleComponents[0] || lensComponents[0];
  if (!existing && initialComponent) assembly.size = initialComponent.size;
  const category = els.collectionCategory.value === "optical" ? "optical" : "sun";
  const nextOrder = Math.max(-1, ...state.models.filter((item) => item.category === category).map((item) => Number(item.order || 0))) + 1;
  const model = normalizeStoredModel({
    id: modelId,
    name: title,
    category,
    access: ["basic", "pro", "studio"].includes(els.collectionAccess.value) ? els.collectionAccess.value : "pro",
    description: els.collectionDescription.value.trim(),
    scadSource: scadFile ? source : existing?.scadSource || source,
    params,
    design: existing?.design || null,
    thumbnail,
    components: {
      front: frontComponents.length ? mergeComponentSummaries(existingComponents.front, frontComponents) : existingComponents.front,
      temples: existingComponents.temples,
      leftTemples: leftTempleComponents.length ? mergeComponentSummaries(existingComponents.leftTemples, leftTempleComponents) : existingComponents.leftTemples,
      rightTemples: rightTempleComponents.length ? mergeComponentSummaries(existingComponents.rightTemples, rightTempleComponents) : existingComponents.rightTemples,
      lenses: lensComponents.length ? mergeComponentSummaries(existingComponents.lenses, lensComponents) : existingComponents.lenses
    },
    assembly,
    order: existing && existing.category === category ? existing.order : nextOrder,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now()
  });
  if (existing) {
    state.models = state.models.map((item) => item.id === existing.id ? model : item);
  } else {
    state.models.unshift(model);
  }
  if (existing && existing.category !== category) normalizeGalleryOrder(existing.category);
  normalizeGalleryOrder(category);
  persistModels({ syncBackend: false });
  await syncCollectionsToBackend({ announce: true }).catch((error) => log(error.message || "Could not save collection to backend."));
  state.editingModelId = model.id;
  selectModel(model.id, { logSelection: false, captureThumbnail: !thumbnail });
  renderGallery();
  clearCollectionUploadInputs();
  els.addCollection.textContent = "Save changes";
  syncStudioModeUi();
  navigateToView("collection-editor");
  log(`${existing ? "Updated" : "Added"} collection: ${model.name}.`);
}

function mergeComponentSummaries(existing = [], added = []) {
  return uniqueComponentsById([...existing, ...added.map(componentSummary).filter(Boolean)]);
}

async function handleCollectionImageSelect() {
  const file = els.collectionImageInput.files?.[0];
  state.croppedCollectionImage = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    log("Choose an image file for the collection photo.");
    return;
  }
  const source = await readFileAsDataUrl(file);
  const image = new Image();
  image.addEventListener("load", () => {
    state.cropImage = image;
    els.cropZoom.value = "1";
    els.cropX.value = "0";
    els.cropY.value = "0";
    els.cropPanel.hidden = false;
    drawImageCrop();
  }, { once: true });
  image.src = source;
}

function drawImageCrop() {
  if (!state.cropImage) return;
  const canvas = els.cropCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const image = state.cropImage;
  const zoom = Number(els.cropZoom.value) || 1;
  const baseScale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const scale = baseScale * zoom;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const maxX = Math.max(0, (drawWidth - width) / 2);
  const maxY = Math.max(0, (drawHeight - height) / 2);
  const offsetX = (Number(els.cropX.value) / 100) * maxX;
  const offsetY = (Number(els.cropY.value) / 100) * maxY;
  const x = (width - drawWidth) / 2 + offsetX;
  const y = (height - drawHeight) / 2 + offsetY;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#090b0b";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);
}

function applyImageCrop() {
  if (!state.cropImage) return;
  drawImageCrop();
  state.croppedCollectionImage = els.cropCanvas.toDataURL("image/jpeg", 0.92);
  els.cropPanel.hidden = true;
  els.cropNote.textContent = "Cropped image ready.";
  log("Cropped gallery image ready.");
}

function cancelImageCrop() {
  state.cropImage = null;
  state.croppedCollectionImage = "";
  els.collectionImageInput.value = "";
  els.cropPanel.hidden = true;
}

function handleComponentFileSelect() {
  const file = els.componentFileInput.files?.[0];
  if (!file) return;
  const cleanName = file.name.replace(/\.[^.]+$/, "");
  if (!els.componentName.value.trim()) els.componentName.value = cleanName.replace(/\bearing\b/gi, "temple");
  if (/lens|lense|szk[lł]o|szk[lł]a|soczew/i.test(file.name)) {
    els.componentKind.value = "lens";
  } else if (/temple|tample|earing|zausz/i.test(file.name)) {
    els.componentKind.value = "temple";
  } else if (/front|frame|ramka/i.test(file.name)) {
    els.componentKind.value = "front";
  }
  if (els.componentKind.value === "temple") {
    els.componentTempleSide.value = inferTempleSide(file.name);
  }
  syncComponentSideInput();
}

function syncComponentSideInput() {
  if (!els.componentTempleSide) return;
  const isTemple = els.componentKind.value === "temple";
  els.componentTempleSide.disabled = !isTemple;
  els.componentTempleSide.classList.toggle("muted-control", !isTemple);
  if (!isTemple) els.componentTempleSide.value = "universal";
}

function startModelEdit(model) {
  selectModel(model.id, { logSelection: false, captureThumbnail: false });
  state.editingModelId = model.id;
  els.collectionTitle.value = model.name;
  els.collectionCategory.value = model.category === "optical" ? "optical" : "sun";
  els.collectionAccess.value = ["basic", "pro", "studio"].includes(modelAccessPlan(model.access)) ? modelAccessPlan(model.access) : "basic";
  els.collectionDescription.value = model.description || "";
  els.galleryScadInput.value = "";
  els.collectionImageInput.value = "";
  els.collectionFrontInput.value = "";
  els.collectionLeftTempleInput.value = "";
  els.collectionRightTempleInput.value = "";
  els.collectionLensInput.value = "";
  els.addCollection.textContent = "Save changes";
  syncStudioModeUi();
  navigateToView("collection-editor");
  log(`Editing collection: ${model.name}.`);
}

function syncStudioModeUi() {
  if (!els.studioModeLabel || !els.clearStudioEdit) return;
  const model = state.editingModelId ? state.models.find((item) => item.id === state.editingModelId) : null;
  els.studioModeLabel.textContent = model ? `${t("editingCollection")}: ${model.name}` : t("newCollection");
  if (els.collectionEditorHeading) els.collectionEditorHeading.textContent = model ? model.name : t("frameEditorHeading");
  els.clearStudioEdit.hidden = !model;
  renderDeveloperCollectionList();
  renderComponentFileList();
  renderFrameEditorAssets();
}

function makeAutoCollectionThumbnail(title, params, category) {
  const accent = category === "optical" ? mixHex(state.brandSettings.accentColor, "#ffffff", 0.22) : state.brandSettings.accentColor;
  const frame = category === "optical" ? "#2c2925" : "#171512";
  const lensW = THREE.MathUtils.clamp(params.lens_width * 1.65, 74, 104);
  const lensH = THREE.MathUtils.clamp(params.lens_height * 1.55, 48, 70);
  const bridge = THREE.MathUtils.clamp(params.bridge_width * 1.2, 16, 30);
  const x1 = 96 - bridge / 2 - lensW;
  const x2 = 96 + bridge / 2;
  const y = 72 - lensH / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 192 126">
    <rect width="192" height="126" fill="#fff8f1"/>
    <rect x="${x1}" y="${y}" width="${lensW}" height="${lensH}" rx="14" fill="none" stroke="${frame}" stroke-width="8"/>
    <rect x="${x2}" y="${y}" width="${lensW}" height="${lensH}" rx="14" fill="none" stroke="${frame}" stroke-width="8"/>
    <path d="M${x1 + lensW} 70 C${90} 62 ${102} 62 ${x2} 70" fill="none" stroke="${frame}" stroke-width="7" stroke-linecap="round"/>
    <path d="M${x1 - 2} ${y + 8} L20 28" fill="none" stroke="${frame}" stroke-width="7" stroke-linecap="round"/>
    <path d="M${x2 + lensW + 2} ${y + 8} L172 28" fill="none" stroke="${frame}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="154" cy="95" r="4" fill="${accent}"/>
    <text x="24" y="110" fill="#766b63" font-size="8" font-family="Inter,Arial" font-weight="700">${escapeHtml(title).slice(0, 26)}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function centerObjectForViewerPivot(object) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3()).sub(object.position);
  object.children.forEach((child) => {
    child.position.sub(center);
  });
}

function normalizeObjectForScene(object) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
}

async function createComponentRecordFromFile(file, kind, options = {}) {
  const formatRaw = file.name.split(".").pop().toLowerCase();
  if (!["3mf", "step", "stp"].includes(formatRaw)) {
    throw new Error(`Unsupported component file: ${file.name}`);
  }
  const format = formatRaw === "stp" ? "step" : formatRaw;
  const cleanName = file.name.replace(/\.[^.]+$/, "");
  const component = {
    id: crypto.randomUUID(),
    name: (options.name || cleanName).trim(),
    kind: ["front", "temple", "lens"].includes(kind) ? kind : "front",
    templeSide: kind === "temple" ? normalizeTempleSide(options.templeSide || inferTempleSide(file.name)) : "",
    size: ["S", "M", "L"].includes(options.size) ? options.size : "M",
    connector: String(options.connector || "FL-H8").trim() || "FL-H8",
    format,
    fileName: file.name,
    byteSize: file.size,
    collectionId: options.collectionId || "",
    source: "uploaded",
    analysis: await analyzeComponentFile(file, format),
    createdAt: Date.now()
  };
  component.materialColor = component.analysis?.materialColor || null;
  await saveComponentRecord(component, file);
  return component;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function clearCollectionForm() {
  state.editingModelId = null;
  state.cropImage = null;
  state.croppedCollectionImage = "";
  els.collectionTitle.value = "";
  els.collectionDescription.value = "";
  els.collectionCategory.value = "sun";
  els.collectionAccess.value = "basic";
  clearCollectionUploadInputs();
  els.addCollection.textContent = t("addCollection");
  syncStudioModeUi();
}

function clearCollectionUploadInputs() {
  els.galleryScadInput.value = "";
  els.collectionImageInput.value = "";
  els.collectionFrontInput.value = "";
  els.collectionLeftTempleInput.value = "";
  els.collectionRightTempleInput.value = "";
  els.collectionLensInput.value = "";
}

function attachComponentToCurrentModel(component) {
  const model = activeEditableModelRecord();
  const summary = componentSummary(component);
  if (!model || !summary) return;
  const components = normalizeModelComponents(model.components) || { front: [], temples: [], leftTemples: [], rightTemples: [], lenses: [] };
  if (component.kind === "front") {
    components.front = uniqueComponentsById([...components.front, summary]);
  } else if (component.kind === "lens") {
    components.lenses = uniqueComponentsById([...components.lenses, summary]);
  } else {
    const side = normalizeTempleSide(component.templeSide);
    if (side === "left") {
      components.leftTemples = uniqueComponentsById([...components.leftTemples, summary]);
    } else if (side === "right") {
      components.rightTemples = uniqueComponentsById([...components.rightTemples, summary]);
    } else {
      components.temples = uniqueComponentsById([...components.temples, summary]);
    }
  }
  model.components = components;
  model.assembly = serializeAssemblySelection();
  model.updatedAt = Date.now();
}

async function addComponentFile() {
  if (!state.editingModelId) {
    log("Save this collection first, then add individual component options.");
    return;
  }
  const file = els.componentFileInput.files?.[0];
  if (!file) {
    log("Choose a 3MF, STEP, or STP file.");
    return;
  }
  const format = file.name.split(".").pop().toLowerCase();
  if (!["3mf", "step", "stp"].includes(format)) {
    log("Supported files are .3mf, .step, and .stp.");
    return;
  }
  const component = await createComponentRecordFromFile(file, els.componentKind.value, {
    collectionId: state.editingModelId || state.activeModelId,
    name: els.componentName.value.trim() || file.name.replace(/\.[^.]+$/, ""),
    size: els.componentSize.value,
    connector: els.componentConnector.value.trim() || "FL-H8",
    templeSide: els.componentTempleSide.value
  });
  state.uploadedComponents = [...await loadSeedComponentAssets(), ...await loadComponentRecords()]
    .filter((item) => !state.hiddenComponentIds.has(item.id));
  await hydrateUploadedComponentMeshes();
  attachComponentToCurrentModel(component);
  rebuildComponentLibrary();
  selectFirstAssemblyVariants();
  applyAssemblyToParams();
  buildBuilderControls();
  buildControls();
  updateGeneratedSource();
  render();
  renderGallery();
  syncActiveModel();
  syncStudioModeUi();
  els.componentFileInput.value = "";
  els.componentName.value = "";
  log(`Added component: ${component.name} (${component.format.toUpperCase()}, ${component.size}, ${component.connector}).`);
}

async function analyzeComponentFile(file, format) {
  if (format === "3mf") {
    try {
      const parsed = await parse3mfComponent(file);
      return parsed.analysis;
    } catch (error) {
      return { readable: false, summary: `3MF saved, preview unavailable: ${error.message}` };
    }
  }
  const header = await file.slice(0, 240).text();
  return {
    readable: /^ISO-10303-21/i.test(header.trim()),
    summary: /^ISO-10303-21/i.test(header.trim()) ? "STEP AP file" : "STEP saved without CAD-kernel validation"
  };
}

async function hydrateUploadedComponentMeshes() {
  await Promise.all(state.uploadedComponents.map(async (component) => {
    if (component.meshObject) return;
    if (component.format !== "3mf" || !component.fileBlob) return;
    try {
      const parsed = await parse3mfComponent(component.fileBlob);
      component.meshObject = parsed.object;
      component.materialColor = parsed.analysis.materialColor;
      component.analysis = { ...(component.analysis || {}), ...parsed.analysis };
    } catch (error) {
      component.analysis = {
        ...(component.analysis || {}),
        readable: false,
        summary: `3MF saved, preview unavailable: ${error.message}`
      };
    }
  }));
}

async function loadSeedComponentAssets() {
  const results = [];
  await Promise.all(seedComponentAssets.map(async (component) => {
    try {
      const response = await fetch(component.assetUrl);
      if (!response.ok) return;
      const blob = await response.blob();
      const parsed = await parse3mfComponent(blob);
      results.push({
        ...component,
        byteSize: blob.size,
        materialColor: parsed.analysis.materialColor,
        analysis: parsed.analysis,
        meshObject: parsed.object,
        createdAt: Date.now()
      });
    } catch {
      // Optional local test assets should never block the app.
    }
  }));
  return results;
}

async function parse3mfComponent(fileOrBlob) {
  const buffer = await fileOrBlob.arrayBuffer();
  const loader = new ThreeMFLoader();
  const object = loader.parse(buffer.slice(0));
  let meshes = 0;
  let triangles = 0;
  object.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    meshes += 1;
    const position = child.geometry.getAttribute("position");
    if (position) triangles += Math.floor(position.count / 3);
  });
  const materialColors = [...new Set([...extract3mfXmlColors(buffer), ...extractObjectMaterialColors(object)])];
  const materialColor = materialColors[0] || null;
  return {
    object,
    analysis: {
      readable: true,
      meshes,
      triangles,
      materialColor,
      materialColors,
      summary: `${meshes} mesh / ${triangles.toLocaleString("en-US")} tris${materialColor ? ` / ${materialColor}` : ""}`
    }
  };
}

function extractObjectMaterialColors(object) {
  const colors = [];
  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (material?.color?.isColor) colors.push(`#${material.color.getHexString().toUpperCase()}`);
    });
  });
  return colors;
}

function extract3mfXmlColors(buffer) {
  try {
    const files = unzipSync(new Uint8Array(buffer));
    const modelFile = files["3D/3dmodel.model"];
    if (!modelFile) return [];
    const xml = strFromU8(modelFile);
    return [...xml.matchAll(/<m:color\b[^>]*\bcolor="(#[0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?"/g)].map((match) => match[1].toUpperCase());
  } catch {
    return [];
  }
}

function parseScadParameters(source) {
  const params = {};
  parameterSchema.forEach(([key, , , min, max]) => {
    const pattern = new RegExp(`(^|\\n)\\s*${escapeRegExp(key)}\\s*=\\s*([-+]?\\d*\\.?\\d+)\\s*;`);
    const match = source.match(pattern);
    if (match) params[key] = THREE.MathUtils.clamp(Number(match[2]), min, max);
  });
  return params;
}

function updateGeneratedSource() {
  els.scadPreview.textContent = generateScadSource();
  els.modelName.textContent = state.modelName;
}

function generateScadSource() {
  const generated = buildGeneratedScad();
  if (!state.scadSource || state.scadSource === sampleScad) return generated;
  let source = state.scadSource;
  parameterSchema.forEach(([key]) => {
    const assignment = `${key} = ${formatNumber(state.params[key])};`;
    const pattern = new RegExp(`(^|\\n)(\\s*)${escapeRegExp(key)}\\s*=\\s*[-+]?\\d*\\.?\\d+\\s*;`);
    if (pattern.test(source)) {
      source = source.replace(pattern, `$1$2${assignment}`);
    } else {
      source = `${assignment}\n${source}`;
    }
  });
  return source;
}

function buildGeneratedScad() {
  const paramLines = parameterSchema
    .map(([key, label, , min, max, step]) => `${key} = ${formatNumber(state.params[key])}; // [${min}:${step}:${max}] ${label}`)
    .join("\n");
  return `${paramLines}

module rounded_square_2d(size=[10,10], r=2) {
  offset(r=r) square([size[0]-2*r, size[1]-2*r], center=true);
}

module lens_rim(cx=0) {
  translate([cx, 0, 0])
  linear_extrude(height=frame_depth, center=true, convexity=8)
  difference() {
    rounded_square_2d([lens_width + rim_thickness*2.15, lens_height + rim_thickness*2.05], corner_radius + rim_thickness*0.9);
    rounded_square_2d([lens_width, lens_height], corner_radius);
  }
}

module soft_bar(size=[10,4,4], r=1) {
  linear_extrude(height=size[2], center=true, convexity=4)
  rounded_square_2d([size[0], size[1]], r);
}

module brow_bar() {
  total_width = bridge_width + lens_width*2 + rim_thickness*5.3;
  translate([0, lens_height/2 + rim_thickness*0.72, 0.05])
  soft_bar([total_width, rim_thickness*1.05, frame_depth*0.95], rim_thickness*0.45);
}

module bridge() {
  translate([0, lens_height*0.08, 0])
  soft_bar([bridge_width + rim_thickness*2.35, rim_thickness*1.15, frame_depth], rim_thickness*0.35);
}

module nose_pads() {
  for (side=[-1,1])
  translate([side*(bridge_width/2 + nose_pad_width/2), -lens_height/4 - nose_pad_drop/4, -frame_depth/2])
  rotate([0, 0, side*10])
  soft_bar([nose_pad_width, rim_thickness*1.45, frame_depth*0.72], rim_thickness*0.35);
}

module temple(side=1) {
  lens_center = (bridge_width + lens_width) / 2;
  hinge_x = side * (lens_center + lens_width/2 + rim_thickness + hinge_width/2);
  translate([hinge_x, lens_height*0.28, -frame_depth*0.08])
  rotate([0, side*temple_spread, 0])
  union() {
    soft_bar([hinge_width, rim_thickness*1.7, frame_depth*1.2], rim_thickness*0.32);
    for (slot=[-1,1])
    translate([side*hinge_width*0.52, slot*rim_thickness*0.42, -frame_depth*0.78])
    rotate([0, 90, 0])
    cylinder(h=hinge_width*0.95, r=rim_thickness*0.34, center=true, $fn=20);
    translate([side*hinge_width*0.34, 0.2, -temple_length/2 - frame_depth*0.5])
    soft_bar([rim_thickness*1.25, rim_thickness*1.05, temple_length], rim_thickness*0.32);
    translate([side*hinge_width*0.34, -temple_drop*0.28, -temple_length - frame_depth*0.5 - temple_drop*0.28])
    rotate([-28, 0, 0])
    soft_bar([rim_thickness*1.3, rim_thickness*1.05, temple_drop], rim_thickness*0.32);
  }
}

module glasses() {
  lens_center = (bridge_width + lens_width) / 2;
  union() {
    lens_rim(-lens_center);
    lens_rim(lens_center);
    brow_bar();
    bridge();
    nose_pads();
    temple(-1);
    temple(1);
  }
}

glasses();
`;
}

function buildDesignScad(draft = state.designDraft) {
  const p = designGeometryParams(draft.params);
  const style = normalizeDesignStyle(draft.style);
  const text = style.templeText.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
  const paramLines = parameterSchema
    .map(([key, label, , min, max, step]) => `${key} = ${formatNumber(p[key])}; // [${min}:${step}:${max}] ${label}`)
    .join("\n");
  return `// Frame Lab Design Lab project
// Parametric sunglasses: edit values here or in Design Lab.

${paramLines}
lens_shape = "${style.lensShape}";
temple_pattern = "${style.templePattern}";
temple_text = "${text}";
brow_bar_enabled = ${style.browBar ? "true" : "false"};
frame_color = "${style.frameColor}";
lens_color = "${style.lensColor}";
detail_color = "${style.detailColor}";

outer_lens_width = (head_width - bridge_width) / 2;
opening_width = min(lens_width, outer_lens_width - rim_thickness * 2.12);
lens_center = bridge_width / 2 + outer_lens_width / 2;

module rounded_rect(size=[10,10], radius=2) {
  offset(r=radius) square([size[0]-2*radius, size[1]-2*radius], center=true);
}

module lens_profile(size=[10,10], outer=false) {
  radius = lens_shape == "round"
    ? min(size[0], size[1]) / 2
    : lens_shape == "sharp"
      ? corner_radius * 0.44 + (outer ? rim_thickness * 0.35 : 0)
      : corner_radius + (outer ? rim_thickness * 0.9 : 0);
  rounded_rect(size, radius);
}

module soft_bar(size=[10,4,4], radius=1) {
  linear_extrude(height=size[2], center=true, convexity=5)
  rounded_rect([size[0], size[1]], radius);
}

module rim(cx=0) {
  translate([cx, 0, 0])
  linear_extrude(height=frame_depth, center=true, convexity=10)
  difference() {
    lens_profile([outer_lens_width, lens_height + rim_thickness*2.05], true);
    lens_profile([opening_width, lens_height], false);
  }
}

module lens_insert(cx=0) {
  translate([cx, 0, frame_depth*0.2])
  linear_extrude(height=max(1, frame_depth*0.36), center=true, convexity=6)
  lens_profile([opening_width-0.4, lens_height-0.4], false);
}

module front() {
  union() {
    rim(-lens_center);
    rim(lens_center);
    if (brow_bar_enabled)
      translate([0, lens_height/2 + rim_thickness*0.72, 0.05])
      soft_bar([head_width, rim_thickness*1.05, frame_depth*0.95], rim_thickness*0.44);
    translate([0, lens_height*0.08, 0])
      soft_bar([bridge_width + rim_thickness*2.35, rim_thickness*1.15, frame_depth], rim_thickness*0.35);
    for (side=[-1,1])
      translate([side*(bridge_width/2 + nose_pad_width/2), -lens_height/4 - nose_pad_drop/4, -frame_depth*0.35])
      rotate([0, 0, side*10])
      soft_bar([nose_pad_width, rim_thickness*1.45, frame_depth*0.72], rim_thickness*0.35);
  }
}

module temple_pattern_relief(side=1) {
  if (temple_pattern == "ribs")
    for (z=[26:9:62])
      translate([side*hinge_width*0.34, rim_thickness*0.06, -z])
      soft_bar([rim_thickness*1.45, rim_thickness*1.14, 1.4], 0.35);
}

module temple_pattern_cutout(side=1) {
  if (temple_pattern == "perforated")
    for (z=[25:11:69])
      translate([side*hinge_width*0.34, 0, -z])
      rotate([90,0,0])
      cylinder(h=rim_thickness*2, r=1, center=true, $fn=20);
}

module temple_mark(side=1) {
  if (temple_text != "")
    translate([side*(hinge_width*0.34 + rim_thickness*0.67), -rim_thickness*0.56, -56])
    rotate([90, side > 0 ? 90 : -90, 0])
    linear_extrude(height=0.45)
    text(temple_text, size=4, halign="center", valign="center");
}

module temple(side=1) {
  hinge_x = side * (head_width/2 + hinge_width/2);
  translate([hinge_x, lens_height*0.27, -frame_depth*0.05])
  rotate([0, side*temple_spread, 0])
  difference() {
    union() {
      soft_bar([hinge_width, rim_thickness*1.7, frame_depth*1.2], rim_thickness*0.32);
      translate([side*hinge_width*0.34, 0, -temple_length/2 - frame_depth*0.5])
        soft_bar([rim_thickness*1.28, rim_thickness*1.08, temple_length], rim_thickness*0.32);
      translate([side*hinge_width*0.34, -temple_drop*0.28, -temple_length - frame_depth*0.5 - temple_drop*0.28])
        rotate([-28, 0, 0])
        soft_bar([rim_thickness*1.34, rim_thickness*1.08, max(1,temple_drop)], rim_thickness*0.32);
      temple_pattern_relief(side);
      temple_mark(side);
    }
    temple_pattern_cutout(side);
  }
}

module frame() {
  color(frame_color) {
    front();
    temple(-1);
    temple(1);
  }
}

module lenses() {
  color(lens_color) {
    lens_insert(-lens_center);
    lens_insert(lens_center);
  }
}

frame();
lenses();
`;
}

async function renderWithOpenScadEndpoint() {
  const endpoint = localStorage.getItem("framelab.openscadEndpoint") || "";
  if (!endpoint) {
    throw new Error("Brak endpointu OpenSCAD.");
  }
  const formData = new FormData();
  formData.append("source", generateScadSource());
  formData.append("parameters", JSON.stringify(state.params));
  formData.append("modelName", state.modelName);
  const response = await fetch(endpoint, { method: "POST", body: formData });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const geometry = new STLLoader().parse(await response.arrayBuffer());
  state.meshObject = new THREE.Mesh(geometry);
  state.previewMode = "stl";
  render();
  return geometry;
}

async function generate3mf() {
  const model = currentModelRecord();
  if (!(await ensureDownloadAllowed(model))) return;
  showLoader(true, "Generating 3MF", "Packing the current geometry for production...");
  await waitFrame();
  try {
    const mesh = collectCurrentMesh();
    if (!mesh.triangles.length) throw new Error("brak geometrii do eksportu");
    const blob = make3mfBlob(mesh);
    const fileName = `${slugify(state.modelName)}.3mf`;
    const saved = await recordDownload(fileName, mesh);
    if (!saved) return;
    downloadBlob(fileName, blob);
    const folderNote = " Saved to your production folder.";
    log(`Generated 3MF locally: ${mesh.triangles.length.toLocaleString("en-US")} triangles.${folderNote}`);
  } catch (error) {
    log(`Could not generate 3MF: ${error.message}`);
  } finally {
    showLoader(false);
  }
}

async function ensureDownloadAllowed(model) {
  if (model && !canAccessModel(model)) {
    openPlansPanel(`${model.name} requires ${accessLabel(model.access)} to download 3MF.`);
    log(`${model.name}: ${t("lockedModel")} ${accessLabel(model.access)}.`);
    return false;
  }
  if (state.account.role === "visitor" || !sessionToken()) {
    openPlansPanel("Create an account and choose Basic, Pro or Plus to download 3MF files.");
    log("Create an account and choose a plan before downloading 3MF.");
    return false;
  }
  await loadDownloadQuota({ silent: true });
  const quota = state.downloadQuota;
  if (quota && quota.limit !== null && quota.remaining <= 0) {
    openPlansPanel(`${planLabel(state.account.plan)} monthly download limit reached. Upgrade your plan to continue exporting 3MF files.`);
    log(`${planLabel(state.account.plan)} monthly download limit reached.`);
    return false;
  }
  return true;
}

async function generateStl() {
  showLoader(true, "Generating STL", "Writing the current geometry...");
  await waitFrame();
  try {
    const mesh = collectCurrentMesh();
    if (!mesh.triangles.length) throw new Error("brak geometrii do eksportu");
    downloadText(`${slugify(state.modelName)}.stl`, makeAsciiStl(mesh), "model/stl");
    log(`Generated STL locally: ${mesh.triangles.length.toLocaleString("en-US")} triangles.`);
  } catch (error) {
    log(`Could not generate STL: ${error.message}`);
  } finally {
    showLoader(false);
  }
}

async function downloadAssemblyPackage() {
  showLoader(true, "Packaging kit", "Collecting selected components and manifest...");
  await waitFrame();
  try {
    const selected = getSelectedUploadedComponents();
    const manifest = buildAssemblyManifest(selected);
    const files = {
      "frame-lab-assembly.json": strToU8(JSON.stringify(manifest, null, 2))
    };
    for (const item of selected) {
      const stored = await getComponentRecord(item.id);
      if (!stored?.fileBlob) continue;
      const bytes = new Uint8Array(await stored.fileBlob.arrayBuffer());
      files[`components/${item.role}-${item.size}-${item.fileName}`] = bytes;
    }
    const zipped = zipSync(files);
    downloadBlob(`${slugify(state.modelName)}-assembly.zip`, new Blob([zipped], { type: "application/zip" }));
    log(`Packaged kit: ${selected.length} component files and JSON manifest.`);
  } catch (error) {
    log(`Could not package kit: ${error.message}`);
  } finally {
    showLoader(false);
  }
}

function getSelectedUploadedComponents() {
  const selected = [
    { role: "front", item: selectedFront(), size: state.assemblySize },
    { role: "leftTemple", item: selectedTemple("leftTemple"), size: state.assemblySize },
    { role: "rightTemple", item: selectedTemple("rightTemple"), size: state.assemblySize },
    { role: "lens", item: selectedLens(), size: state.assemblySize }
  ];
  return selected
    .filter(({ item }) => item?.source === "uploaded")
    .map(({ role, item, size }) => ({
      role,
      id: item.id,
      name: item.name,
      size,
      connector: item.connector,
      format: item.format,
      fileName: item.fileName
    }));
}

function buildAssemblyManifest(selectedFiles) {
  return {
    app: "Frame Lab",
    version: 1,
    createdAt: new Date().toISOString(),
    assembly: {
      size: state.assemblySize,
      front: serializeAssemblyPart("front", selectedFront(), state.assemblySize),
      leftTemple: serializeAssemblyPart("leftTemple", selectedTemple("leftTemple"), state.assemblySize),
      rightTemple: serializeAssemblyPart("rightTemple", selectedTemple("rightTemple"), state.assemblySize),
      lens: serializeAssemblyPart("lens", selectedLens(), state.assemblySize)
    },
    parameters: state.params,
    lens: currentLensConfig(),
    colors: { ...state.componentColors },
    colorSlots: normalizeColorSlots(state.colorSlots),
    selectedFiles
  };
}

function serializeAssemblyPart(role, item, size) {
  if (!item) {
    return {
      role,
      id: null,
      name: null,
      size: null,
      connector: null,
      source: "none",
      format: null,
      fileName: null
    };
  }
  return {
    role,
    id: item.id,
    name: item.name,
    size,
    connector: item.connector,
    source: item.source || "demo",
    format: item.format || "generated",
    fileName: item.fileName || null
  };
}

function currentLensConfig() {
  const lens = selectedLens();
  return {
    mode: lens ? "component" : "none",
    label: lens?.name || "No lenses",
    note: lens?.fileName || "No lens model selected"
  };
}

function currentConfigurationSnapshot() {
  const model = currentModelRecord();
  const manifest = buildAssemblyManifest(getSelectedUploadedComponents());
  return {
    model: {
      id: model?.id || state.activeModelId,
      name: state.modelName,
      access: modelAccessPlan(model?.access)
    },
    assembly: manifest.assembly,
    parameters: { ...state.params },
    lens: manifest.lens,
    colors: manifest.colors,
    selectedFiles: manifest.selectedFiles
  };
}

async function recordDownload(fileName, mesh) {
  if (state.account.role === "visitor" || !sessionToken()) return false;
  const model = currentModelRecord();
  const payload = {
    fileName,
    modelId: model?.id || state.activeModelId,
    modelName: state.modelName,
    plan: modelAccessPlan(model?.access),
    lensMode: currentLensConfig().mode,
    lensLabel: selectedLensLabel(),
    configuration: {
      ...currentConfigurationSnapshot(),
      mesh: {
        triangles: mesh.triangles.length,
        vertices: mesh.vertices.length
      }
    }
  };
  try {
    const response = await apiRequest("/api/downloads", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.downloads = [response.download, ...state.downloads.filter((item) => item.id !== response.download.id)].slice(0, 100);
    state.downloadQuota = response.quota || state.downloadQuota;
    renderDownloadFolder();
    return true;
  } catch (error) {
    if (/download limit|Upgrade your plan/i.test(error.message || "")) openPlansPanel(error.message);
    log(error.message || "Could not save download history.");
    return false;
  }
}

function saveCurrentModel() {
  syncActiveModel();
  queueThumbnailCapture();
  log(`Saved model to gallery: ${state.modelName}.`);
}

function loadSample() {
  state.params = structuredClone(defaultParams);
  state.scadSource = sampleScad;
  state.modelName = "Frame 001";
  state.lensMode = selectedLens() ? "component" : "none";
  state.meshObject = null;
  buildControls();
  updateGeneratedSource();
  render();
  syncActiveModel();
  queueThumbnailCapture();
  log("Loaded the Frame Lab sample model.");
}

function resetParams() {
  state.params = structuredClone(defaultParams);
  state.lensMode = selectedLens() ? "component" : "none";
  state.meshObject = null;
  buildControls();
  updateGeneratedSource();
  render();
  syncActiveModel();
  queueThumbnailCapture();
  log("Parameters restored to the production baseline.");
}

function exportScad() {
  downloadText(`${slugify(state.modelName)}.scad`, generateScadSource(), "application/scad");
  log("Exported plik OpenSCAD.");
}

function exportJson() {
  downloadText(`${slugify(state.modelName)}-params.json`, JSON.stringify(state.params, null, 2), "application/json");
  log("Exported parameter JSON.");
}

async function copyScad() {
  await navigator.clipboard.writeText(generateScadSource());
  log("Copied OpenSCAD source to clipboard.");
}

function saveEndpoint() {
  localStorage.setItem("framelab.openscadEndpoint", els.renderEndpoint.value.trim());
  log("Saved OpenSCAD endpoint.");
}

function loadSettings() {
  els.renderEndpoint.value = localStorage.getItem("framelab.openscadEndpoint") || "";
  state.lang = "en";
  try {
    const storedBrand = JSON.parse(localStorage.getItem(brandSettingsStorageKey) || "null");
    if (storedBrand) state.brandSettings = normalizeBrandSettings(storedBrand);
  } catch {
    state.brandSettings = structuredClone(defaultBrandSettings);
  }
  try {
    const hidden = JSON.parse(localStorage.getItem(hiddenComponentsStorageKey) || "[]");
    state.hiddenComponentIds = new Set(Array.isArray(hidden) ? hidden.map(String) : []);
  } catch {
    state.hiddenComponentIds = new Set();
  }
  try {
    state.colorSlots = normalizeColorSlots(JSON.parse(localStorage.getItem(colorSlotsStorageKey) || "null"));
  } catch {
    state.colorSlots = [...defaultColorSlots];
  }
  try {
    const storedAccount = JSON.parse(localStorage.getItem(accountStorageKey) || "null");
    if (storedAccount && typeof storedAccount === "object") {
      const email = String(storedAccount.email || "").toLowerCase();
      const profile = accountProfile(email);
      state.account.email = email;
      state.account.firstName = profile?.firstName || storedAccount.firstName || "";
      state.account.lastName = profile?.lastName || storedAccount.lastName || "";
      state.account.role = isAdminEmail(email) ? "developer" : (profile?.role || storedAccount.role) === "customer" ? "customer" : "visitor";
      state.account.plan = state.account.role === "developer" ? "studio" : (validAccountPlan(profile?.plan || storedAccount.plan) ? (profile?.plan || storedAccount.plan) : "free");
      state.account.subscriptionMode = profile?.subscriptionMode || storedAccount.subscriptionMode || "free";
      state.account.subscriptionStatus = profile?.subscriptionStatus || storedAccount.subscriptionStatus || "none";
      state.account.planEndsAt = profile?.planEndsAt || storedAccount.planEndsAt || null;
      state.account.measurements = sanitizeMeasurements(profile?.measurements || storedAccount.measurements || {});
    }
  } catch {
    state.account = accountFromUser(null);
  }
  if (!sessionToken()) state.account = accountFromUser(null);
  document.documentElement.lang = "en";
}

function setView(view) {
  if (view === "front") state.viewerRotation = { x: 0, y: 0, z: 0 };
  if (view === "side") state.viewerRotation = { x: 0, y: Math.PI / 2, z: 0 };
  if (view === "iso") state.viewerRotation = { x: -0.48, y: 0.62, z: 0.03 };
  applyViewerTransform();
}

function handleCanvasWheel(event) {
  event.preventDefault();
  const direction = Math.exp(THREE.MathUtils.clamp(event.deltaY, -220, 220) * 0.0015);
  cameraZoomScale = THREE.MathUtils.clamp(cameraZoomScale * direction, 0.35, 3.4);
  updateCameraFromZoom();
}

function applyViewerTransform() {
  modelGroup.rotation.order = "YXZ";
  modelGroup.rotation.set(state.viewerRotation.x, state.viewerRotation.y, state.viewerRotation.z);
  modelGroup.position.set(modelBasePosition.x + state.viewerPan.x, modelBasePosition.y + state.viewerPan.y, modelBasePosition.z);
}

function normalizeOrbitAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;
}

function viewerPanSpeed(canvasHeight = els.canvas?.clientHeight || 720) {
  const base = Math.max(0.045, viewerFitRadius / Math.max(440, canvasHeight));
  return base * Math.max(0.65, Math.min(1.35, cameraZoomScale));
}

function resetViewerPose() {
  state.viewerRotation = { x: -0.48, y: 0.62, z: 0.03 };
  state.viewerPan = { x: 0, y: 0 };
  cameraZoomScale = 1;
  render();
}

function updateMetrics() {
  els.metricWidth.textContent = Math.round(state.params.head_width);
  els.metricBridge.textContent = formatNumber(state.params.bridge_width);
  els.metricTemple.textContent = Math.round(state.params.temple_length);
}

function resize() {
  const rect = els.canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate() {
  resize();
  renderer.render(scene, camera);
  if (designRenderer && designScene && designCamera) {
    resizeDesignScene();
    designRenderer.render(designScene, designCamera);
  }
  requestAnimationFrame(animate);
}

function fitCameraToObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  viewerFitRadius = Math.max(1, sphere.radius);
  cameraBaseDistance = Math.max(95, sphere.radius * 1.85);
  cameraBaseHeight = sphere.radius * 0.32;
  const panelShift = sphere.radius * 0.32;
  cameraTarget.set(sphere.center.x + panelShift, sphere.center.y, sphere.center.z);
  updateCameraFromZoom();
}

function updateCameraFromZoom() {
  if (!camera) return;
  camera.position.set(cameraTarget.x, cameraTarget.y + cameraBaseHeight, cameraTarget.z + cameraBaseDistance);
  camera.lookAt(cameraTarget);
  camera.zoom = 1 / cameraZoomScale;
  camera.near = Math.max(0.1, cameraBaseDistance / 100);
  camera.far = cameraBaseDistance * 8;
  camera.updateProjectionMatrix();
}

function addTriangles(geometry, multiplier = 1) {
  const position = geometry.getAttribute("position");
  if (!position) return;
  triangleCount += Math.floor(position.count / 3) * multiplier;
}

function findParam(key) {
  return parameterSchema.find(([item]) => item === key);
}

function formatValue(value, unit) {
  return `${formatNumber(Number(value))}${unit ? ` ${unit}` : ""}`;
}

function formatNumber(value) {
  return Number(value).toFixed(Number.isInteger(Number(value)) ? 0 : 1);
}

function log(message) {
  els.importLog.textContent = message;
}

function showLoader(visible, title = "Preparing file", text = "Preparing production geometry...") {
  els.loaderOverlay.hidden = !visible;
  els.loaderTitle.textContent = title;
  els.loaderText.textContent = text;
}

function collectCurrentMesh() {
  modelGroup.updateMatrixWorld(true);
  const vertices = [];
  const triangles = [];
  const vertexMap = new Map();
  const addVertex = (vector) => {
    const key = `${vector.x.toFixed(5)},${vector.y.toFixed(5)},${vector.z.toFixed(5)}`;
    if (vertexMap.has(key)) return vertexMap.get(key);
    const index = vertices.length;
    vertices.push({ x: vector.x, y: vector.y, z: vector.z });
    vertexMap.set(key, index);
    return index;
  };

  modelGroup.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const geometry = child.geometry;
    const position = geometry.getAttribute("position");
    if (!position) return;
    const index = geometry.index;
    const matrix = child.matrixWorld;
    const readVertex = (i) => new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i)).applyMatrix4(matrix);
    const triangleTotal = index ? Math.floor(index.count / 3) : Math.floor(position.count / 3);
    for (let i = 0; i < triangleTotal; i += 1) {
      const aIndex = index ? index.getX(i * 3) : i * 3;
      const bIndex = index ? index.getX(i * 3 + 1) : i * 3 + 1;
      const cIndex = index ? index.getX(i * 3 + 2) : i * 3 + 2;
      const a = readVertex(aIndex);
      const b = readVertex(bIndex);
      const c = readVertex(cIndex);
      if (triangleArea(a, b, c) < 1e-8) continue;
      triangles.push([addVertex(a), addVertex(b), addVertex(c)]);
    }
  });

  return { vertices, triangles };
}

function make3mfBlob(mesh) {
  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">${escapeXml(state.modelName)}</metadata>
  <metadata name="Designer">Frame Lab</metadata>
  <metadata name="Lens">${escapeXml(lensModeLabel())}</metadata>
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
${mesh.vertices.map((vertex) => `          <vertex x="${formatMeshNumber(vertex.x)}" y="${formatMeshNumber(vertex.y)}" z="${formatMeshNumber(vertex.z)}"/>`).join("\n")}
        </vertices>
        <triangles>
${mesh.triangles.map(([a, b, c]) => `          <triangle v1="${a}" v2="${b}" v3="${c}"/>`).join("\n")}
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1"/>
  </build>
</model>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

  const zipped = zipSync({
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rels),
    "3D/3dmodel.model": strToU8(modelXml)
  });
  return new Blob([zipped], { type: "model/3mf" });
}

function makeAsciiStl(mesh) {
  const lines = [`solid ${slugify(state.modelName)}`];
  mesh.triangles.forEach(([ia, ib, ic]) => {
    const a = mesh.vertices[ia];
    const b = mesh.vertices[ib];
    const c = mesh.vertices[ic];
    const normal = triangleNormal(a, b, c);
    lines.push(`  facet normal ${formatMeshNumber(normal.x)} ${formatMeshNumber(normal.y)} ${formatMeshNumber(normal.z)}`);
    lines.push("    outer loop");
    lines.push(`      vertex ${formatMeshNumber(a.x)} ${formatMeshNumber(a.y)} ${formatMeshNumber(a.z)}`);
    lines.push(`      vertex ${formatMeshNumber(b.x)} ${formatMeshNumber(b.y)} ${formatMeshNumber(b.z)}`);
    lines.push(`      vertex ${formatMeshNumber(c.x)} ${formatMeshNumber(c.y)} ${formatMeshNumber(c.z)}`);
    lines.push("    endloop");
    lines.push("  endfacet");
  });
  lines.push(`endsolid ${slugify(state.modelName)}`);
  return lines.join("\n");
}

function triangleArea(a, b, c) {
  const ab = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
  const ac = new THREE.Vector3(c.x - a.x, c.y - a.y, c.z - a.z);
  return ab.cross(ac).length() * 0.5;
}

function triangleNormal(a, b, c) {
  const ab = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
  const ac = new THREE.Vector3(c.x - a.x, c.y - a.y, c.z - a.z);
  return ab.cross(ac).normalize();
}

function formatMeshNumber(value) {
  return Number(value).toFixed(5).replace(/\.?0+$/, "");
}

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&apos;"
  })[char]);
}

function escapeHtml(value) {
  return String(value).replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function downloadText(name, content, type) {
  const blob = new Blob([content], { type });
  downloadBlob(name, blob);
}

function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function waitFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function openComponentDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(componentDbName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(componentStoreName, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadComponentRecords() {
  const remote = await loadBackendComponentRecords().catch(() => []);
  if (remote.length) return remote;
  return loadLocalComponentRecords().catch(() => []);
}

async function loadLocalComponentRecords() {
  const db = await openComponentDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(componentStoreName, "readonly").objectStore(componentStoreName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadBackendComponentRecords() {
  const payload = await apiRequest("/api/components");
  const components = Array.isArray(payload.components) ? payload.components : [];
  return components.map(componentRecordFromBackend).filter(Boolean);
}

function componentRecordFromBackend(record) {
  if (!record || typeof record !== "object") return null;
  const component = { ...record, source: "uploaded" };
  if (record.fileData) {
    component.fileBlob = dataUrlToFile(record.fileData, record.fileName || `component.${record.format || "3mf"}`);
  }
  delete component.fileData;
  return component;
}

async function getComponentRecord(id) {
  const local = await getLocalComponentRecord(id).catch(() => null);
  if (local) return local;
  const remote = await loadBackendComponentRecords().catch(() => []);
  return remote.find((component) => component.id === id) || null;
}

async function getLocalComponentRecord(id) {
  const db = await openComponentDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(componentStoreName, "readonly").objectStore(componentStoreName).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveComponentRecord(component, file) {
  await Promise.allSettled([
    saveLocalComponentRecord(component, file),
    saveComponentRecordToBackend(component, file)
  ]);
}

async function saveLocalComponentRecord(component, file) {
  const db = await openComponentDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(componentStoreName, "readwrite");
    tx.objectStore(componentStoreName).put({ ...component, fileBlob: file });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteComponentRecord(id) {
  await Promise.allSettled([
    deleteLocalComponentRecord(id),
    deleteComponentRecordFromBackend(id)
  ]);
}

async function saveComponentRecordToBackend(component, file) {
  if (!isDeveloper() || !sessionToken()) return false;
  const fileData = await readFileAsDataUrl(file);
  await apiRequest("/api/components", {
    method: "PUT",
    body: JSON.stringify({ component: { ...component, fileData } })
  });
  return true;
}

async function deleteComponentRecordFromBackend(id) {
  if (!isDeveloper() || !sessionToken()) return false;
  await apiRequest(`/api/components/${encodeURIComponent(id)}`, { method: "DELETE" });
  return true;
}

async function deleteLocalComponentRecord(id) {
  const db = await openComponentDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(componentStoreName, "readwrite");
    tx.objectStore(componentStoreName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dataUrlToFile(dataUrl, fileName) {
  const [header, payload] = String(dataUrl || "").split(",");
  if (!header || !payload) return null;
  const mime = header.match(/^data:([^;]+)/)?.[1] || "application/octet-stream";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  try {
    return new File([bytes], fileName, { type: mime });
  } catch {
    return new Blob([bytes], { type: mime });
  }
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "model";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
