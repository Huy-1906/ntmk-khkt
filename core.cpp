/************************************************************
 * ==========================================================
 *       MÔ HÌNH NGUYÊN TỬ - MODEL A (20 SERVO)
 *       ESP32 + 2x PCA9685 + 20 SG90 + Blynk IoT
 * ==========================================================
 *
 * BLYNK VIRTUAL PINS:
 *   V0       = RESET (Hạ tuần tự)
 *   V1..V20  = Chọn nguyên tố Z1 (H) đến Z20 (Ca)
 *   V100     = LIÊN KẾT ION
 *   V102     = NAM CHÂM ĐIỆN (ON/OFF độc lập)
 *
 * HARDWARE:
 *   ESP32:
 *     SDA      = GPIO21
 *     SCL      = GPIO22
 *     Magnet   = GPIO18
 *
 *   PCA9685:
 *     Board A  = 0x40 (Kênh 0..15 -> Servo 0..15)
 *     Board B  = 0x41 (Kênh 0..3  -> Servo 16..19)
 *
 * LOGICAL SHELL MAPPING:
 *   Lớp K (1): Servo 0, 1
 *   Lớp L (2): Servo 2..9
 *   Lớp M (3): Servo 10..17
 *   Lớp N (4): Servo 18, 19
 *
 ************************************************************/

// ==========================================================
// 1. BLYNK CONFIGURATION
// ==========================================================
#define BLYNK_TEMPLATE_ID   "TMPL6IQvhzg7F"
#define BLYNK_TEMPLATE_NAME "Mo Hinh Nguyen Tu"
#include "secrets.h"  // BLYNK_AUTH_TOKEN, WIFI_SSID_VALUE, WIFI_PASS_VALUE (xem secrets.example.h)

#define BLYNK_PRINT Serial

// ==========================================================
// 2. LIBRARIES
// ==========================================================
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <BlynkSimpleEsp32.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

// ==========================================================
// 3. WIFI CONFIGURATION
// ==========================================================
const char WIFI_SSID[] = WIFI_SSID_VALUE;
const char WIFI_PASS[] = WIFI_PASS_VALUE;
char auth[] = BLYNK_AUTH_TOKEN;

// ==========================================================
// 4. HARDWARE PINS & ADDRESSES
// ==========================================================
constexpr uint8_t SDA_PIN = 21;
constexpr uint8_t SCL_PIN = 22;
constexpr uint8_t MAGNET_PIN = 18; // Nam châm điều khiển độc lập qua GPIO18

constexpr uint8_t PCA1_ADDR = 0x40;
constexpr uint8_t PCA2_ADDR = 0x41;
constexpr uint16_t SERVO_FREQUENCY = 50;

// ==========================================================
// 5. SERVO PULSE CONFIGURATION (MICROSECONDS)
// ==========================================================
constexpr uint16_t PULSE_RAISE_US = 1200; // Servo NHÔ LÊN
constexpr uint16_t PULSE_LOWER_US = 1350; // Servo HẠ XUỐNG

// ==========================================================
// 6. SCHEDULER TIMING & SERVO MAPPING
// ==========================================================
constexpr uint32_t SERVO_STEP_INTERVAL_MS = 40; // Khoảng thời gian 40ms giữa mỗi servo
constexpr uint8_t ELECTRON_COUNT = 20;

// Mapping 20 Electron theo đúng thứ tự phần cứng
const uint8_t ELECTRON_CHANNELS[ELECTRON_COUNT] = {
  // Lớp K (0, 1)
  0, 1,
  // Lớp L (2..9)
  2, 3, 4, 5, 6, 7, 8, 9,
  // Lớp M (10..17)
  10, 11, 12, 13, 14, 15, 16, 17,
  // Lớp N (18, 19)
  18, 19
};

// Đảo chiều Servo nếu cần (mặc định false)
bool SERVO_REVERSED[ELECTRON_COUNT] = {
  false, false, false, false, false,
  false, false, false, false, false,
  false, false, false, false, false,
  false, false, false, false, false
};

// ==========================================================
// 7. OBJECTS & STATE VARIABLES
// ==========================================================
Adafruit_PWMServoDriver pca1(PCA1_ADDR);
Adafruit_PWMServoDriver pca2(PCA2_ADDR);

enum ElementType {
  ELEMENT_UNKNOWN,
  ELEMENT_METAL,
  ELEMENT_NONMETAL,
  ELEMENT_METALLOID
};

struct Element {
  uint8_t Z;
  const char* symbol;
  const char* name;
  ElementType type;
  uint8_t shell1;
  uint8_t shell2;
  uint8_t shell3;
  uint8_t shell4;
  uint8_t ionicTransfer;
};

uint8_t currentZ = 0;

// Trạng thái Servo (false = HẠ, true = NHÔ)
bool electronCurrent[ELECTRON_COUNT];
bool electronTarget[ELECTRON_COUNT];

uint32_t lastServoStep = 0;
uint8_t nextElectronScan = 0;

uint32_t lastWiFiReconnect = 0;
uint32_t lastBlynkReconnect = 0;

// ==========================================================
// 8. DATABASE NGUYÊN TỐ Z = 1..20
// ==========================================================
const Element ELEMENTS[21] = {
  {0,  "",   "",          ELEMENT_UNKNOWN,   0, 0, 0, 0, 0},
  {1,  "H",  "Hydrogen",  ELEMENT_NONMETAL,  1, 0, 0, 0, 1},
  {2,  "He", "Helium",    ELEMENT_NONMETAL,  2, 0, 0, 0, 0},
  {3,  "Li", "Lithium",   ELEMENT_METAL,     2, 1, 0, 0, 1},
  {4,  "Be", "Beryllium", ELEMENT_METAL,     2, 2, 0, 0, 2},
  {5,  "B",  "Boron",     ELEMENT_METALLOID, 2, 3, 0, 0, 0},
  {6,  "C",  "Carbon",    ELEMENT_NONMETAL,  2, 4, 0, 0, 4},
  {7,  "N",  "Nitrogen",  ELEMENT_NONMETAL,  2, 5, 0, 0, 3},
  {8,  "O",  "Oxygen",    ELEMENT_NONMETAL,  2, 6, 0, 0, 2},
  {9,  "F",  "Fluorine",  ELEMENT_NONMETAL,  2, 7, 0, 0, 1},
  {10, "Ne", "Neon",      ELEMENT_NONMETAL,  2, 8, 0, 0, 0},
  {11, "Na", "Sodium",    ELEMENT_METAL,     2, 8, 1, 0, 1},
  {12, "Mg", "Magnesium", ELEMENT_METAL,     2, 8, 2, 0, 2},
  {13, "Al", "Aluminium", ELEMENT_METAL,     2, 8, 3, 0, 3},
  {14, "Si", "Silicon",   ELEMENT_METALLOID, 2, 8, 4, 0, 0},
  {15, "P",  "Phosphorus",ELEMENT_NONMETAL,  2, 8, 5, 0, 3},
  {16, "S",  "Sulfur",    ELEMENT_NONMETAL,  2, 8, 6, 0, 2},
  {17, "Cl", "Chlorine",  ELEMENT_NONMETAL,  2, 8, 7, 0, 1},
  {18, "Ar", "Argon",     ELEMENT_NONMETAL,  2, 8, 8, 0, 0},
  {19, "K",  "Potassium", ELEMENT_METAL,     2, 8, 8, 1, 1},
  {20, "Ca", "Calcium",   ELEMENT_METAL,     2, 8, 8, 2, 2}
};

// ==========================================================
// 9. HELPER FUNCTIONS & PCA DRIVER
// ==========================================================
uint16_t microsecondsToTicks(uint16_t pulseUs) {
  uint32_t ticks = ((uint32_t)pulseUs * 4096UL) / 20000UL;
  if (ticks > 4095UL) ticks = 4095UL;
  return (uint16_t)ticks;
}

void setLogicalChannel(uint8_t logicalChannel, uint16_t pulseUs) {
  if (logicalChannel >= 20) return;

  uint16_t ticks = microsecondsToTicks(pulseUs);
  if (logicalChannel < 16) {
    pca1.setPWM(logicalChannel, 0, ticks);
  } else {
    pca2.setPWM(logicalChannel - 16, 0, ticks);
  }
}

uint16_t getElectronPulse(uint8_t electronIndex, bool raised) {
  bool physicalRaised = raised;
  if (SERVO_REVERSED[electronIndex]) {
    physicalRaised = !physicalRaised;
  }
  return physicalRaised ? PULSE_RAISE_US : PULSE_LOWER_US;
}

void setElectronTarget(uint8_t index, bool raised) {
  if (index < ELECTRON_COUNT) {
    electronTarget[index] = raised;
  }
}

void clearAllTargets() {
  for (uint8_t i = 0; i < ELECTRON_COUNT; i++) {
    electronTarget[i] = false;
  }
}

// ==========================================================
// 10. SCHEDULER (QUÉT VÀ CẬP NHẬT TỪNG SERVO MỖI 40MS)
// ==========================================================
void updateServoScheduler() {
  if (millis() - lastServoStep < SERVO_STEP_INTERVAL_MS) {
    return;
  }
  lastServoStep = millis();

  for (uint8_t checked = 0; checked < ELECTRON_COUNT; checked++) {
    uint8_t i = (nextElectronScan + checked) % ELECTRON_COUNT;
    if (electronCurrent[i] != electronTarget[i]) {
      uint16_t pulse = getElectronPulse(i, electronTarget[i]);
      setLogicalChannel(ELECTRON_CHANNELS[i], pulse);
      electronCurrent[i] = electronTarget[i];
      nextElectronScan = (i + 1) % ELECTRON_COUNT;
      return; // Cập nhật đúng 1 servo rồi nhường CPU cho Blynk.run()
    }
  }
}

// ==========================================================
// 11. ATOM DISPLAY LOGIC
// ==========================================================
void setShellTargets(uint8_t shellStart, uint8_t shellCapacity, uint8_t electronCount) {
  if (electronCount > shellCapacity) electronCount = shellCapacity;
  for (uint8_t i = 0; i < shellCapacity; i++) {
    setElectronTarget(shellStart + i, i < electronCount);
  }
}

void displayNeutralAtom(const Element& element) {
  clearAllTargets();

  setShellTargets(0, 2, element.shell1);   // Lớp K
  setShellTargets(2, 8, element.shell2);   // Lớp L
  setShellTargets(10, 8, element.shell3);  // Lớp M
  setShellTargets(18, 2, element.shell4);  // Lớp N

  Serial.println("\n----------------------------------------");
  Serial.printf("[ATOM] %s | Z = %d\n", element.symbol, element.Z);
  Serial.printf("[ATOM] Cấu hình E = %d - %d - %d - %d\n", element.shell1, element.shell2, element.shell3, element.shell4);
  Serial.println("----------------------------------------");
}

void selectAtom(uint8_t Z) {
  if (Z < 1 || Z > 20) return;
  currentZ = Z;
  const Element& element = ELEMENTS[currentZ];

  displayNeutralAtom(element);
  Serial.printf("[ATOM] Đã chọn: %s (Z=%d)\n", element.name, element.Z);
}

// ==========================================================
// 12. IONIC BOND LOGIC
// ==========================================================
int8_t getOuterShellIndex(const Element& element) {
  if (element.shell4 > 0) return 3;
  if (element.shell3 > 0) return 2;
  if (element.shell2 > 0) return 1;
  if (element.shell1 > 0) return 0;
  return -1;
}

void removeOuterElectrons(const Element& element, uint8_t amount) {
  int8_t shell = getOuterShellIndex(element);
  if (shell < 0) return;

  uint8_t shellStart = (shell == 0) ? 0 : (shell == 1) ? 2 : (shell == 2) ? 10 : 18;
  uint8_t shellCount = (shell == 0) ? element.shell1 : (shell == 1) ? element.shell2 : (shell == 2) ? element.shell3 : element.shell4;

  int16_t index = shellStart + shellCount - 1;
  while (amount > 0 && index >= shellStart) {
    setElectronTarget((uint8_t)index, false);
    amount--;
    index--;
  }
}

void addOuterElectrons(const Element& element, uint8_t amount) {
  int8_t shell = getOuterShellIndex(element);
  if (shell < 0) return;

  uint8_t shellStart = (shell == 0) ? 0 : (shell == 1) ? 2 : (shell == 2) ? 10 : 18;
  uint8_t shellCapacity = (shell == 0 || shell == 3) ? 2 : 8;

  for (uint8_t i = 0; i < shellCapacity && amount > 0; i++) {
    uint8_t index = shellStart + i;
    if (!electronTarget[index]) {
      electronTarget[index] = true;
      amount--;
    }
  }
}

void executeIonicBond() {
  if (currentZ < 1 || currentZ > 20) {
    Serial.println("[IONIC] Chưa chọn nguyên tố!");
    return;
  }

  const Element& element = ELEMENTS[currentZ];
  Serial.println("\n========================================");
  Serial.println("             IONIC BOND                 ");
  Serial.println("========================================");
  Serial.printf("Element: %s | Z=%d\n", element.symbol, element.Z);

  displayNeutralAtom(element);

  if (element.ionicTransfer == 0) {
    Serial.println("[IONIC] Không có chuyển electron đơn giản.");
    return;
  }

  if (element.type == ELEMENT_METAL) {
    removeOuterElectrons(element, element.ionicTransfer);
    Serial.printf("[IONIC] %s nhường %d electron -> CATION (+)\n", element.symbol, element.ionicTransfer);
  } else if (element.type == ELEMENT_NONMETAL) {
    addOuterElectrons(element, element.ionicTransfer);
    Serial.printf("[IONIC] %s nhận %d electron -> ANION (-)\n", element.symbol, element.ionicTransfer);
  } else {
    Serial.printf("[IONIC] %s là metalloid -> không mô phỏng ion.\n", element.symbol);
  }
  Serial.println("========================================");
}

// ==========================================================
// 13. RESET LOGIC (HẠ TUẦN TỰ)
// ==========================================================
void resetModel() {
  Serial.println("\n========================================");
  Serial.println("             RESET MODEL A              ");
  Serial.println("========================================");

  // Cập nhật target về false, Scheduler sẽ hạ tuần tự từng servo
  clearAllTargets();
  
  lastServoStep = 0;
  nextElectronScan = 0;
  currentZ = 0;

  Serial.println("[RESET] Đặt mục tiêu: 20 electron = DOWN");
  Serial.println("[RESET] Current atom = NONE");
  Serial.println("========================================");
}

// ==========================================================
// 14. BLYNK CALLBACKS
// ==========================================================
BLYNK_WRITE(V0)   { if (param.asInt() == 1) resetModel(); }
BLYNK_WRITE(V1)   { if (param.asInt() == 1) selectAtom(1); }
BLYNK_WRITE(V2)   { if (param.asInt() == 1) selectAtom(2); }
BLYNK_WRITE(V3)   { if (param.asInt() == 1) selectAtom(3); }
BLYNK_WRITE(V4)   { if (param.asInt() == 1) selectAtom(4); }
BLYNK_WRITE(V5)   { if (param.asInt() == 1) selectAtom(5); }
BLYNK_WRITE(V6)   { if (param.asInt() == 1) selectAtom(6); }
BLYNK_WRITE(V7)   { if (param.asInt() == 1) selectAtom(7); }
BLYNK_WRITE(V8)   { if (param.asInt() == 1) selectAtom(8); }
BLYNK_WRITE(V9)   { if (param.asInt() == 1) selectAtom(9); }
BLYNK_WRITE(V10)  { if (param.asInt() == 1) selectAtom(10); }
BLYNK_WRITE(V11)  { if (param.asInt() == 1) selectAtom(11); }
BLYNK_WRITE(V12)  { if (param.asInt() == 1) selectAtom(12); }
BLYNK_WRITE(V13)  { if (param.asInt() == 1) selectAtom(13); }
BLYNK_WRITE(V14)  { if (param.asInt() == 1) selectAtom(14); }
BLYNK_WRITE(V15)  { if (param.asInt() == 1) selectAtom(15); }
BLYNK_WRITE(V16)  { if (param.asInt() == 1) selectAtom(16); }
BLYNK_WRITE(V17)  { if (param.asInt() == 1) selectAtom(17); }
BLYNK_WRITE(V18)  { if (param.asInt() == 1) selectAtom(18); }
BLYNK_WRITE(V19)  { if (param.asInt() == 1) selectAtom(19); }
BLYNK_WRITE(V20)  { if (param.asInt() == 1) selectAtom(20); }

BLYNK_WRITE(V100) { if (param.asInt() == 1) executeIonicBond(); }

// Điều khiển Nam châm điện độc lập qua V102
BLYNK_WRITE(V102) {
  int state = param.asInt();
  digitalWrite(MAGNET_PIN, state ? HIGH : LOW);
  Serial.printf("[MAGNET] %s\n", state ? "ON" : "OFF");
}

// ==========================================================
// 15. NETWORK & SYSTEM INITIALIZATION
// ==========================================================
void connectWiFi() {
  Serial.println("\n[WIFI] Connecting...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
}

bool checkI2CAddress(uint8_t address) {
  Wire.beginTransmission(address);
  return (Wire.endTransmission() == 0);
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n================================================");
  Serial.println("       ATOMIC EDUCATION MODEL - MODEL A");
  Serial.println("       ESP32 + 2x PCA9685 + BLYNK (20 SERVO)");
  Serial.println("================================================");

  // Khởi tạo Chân Nam Châm (GPIO18)
  pinMode(MAGNET_PIN, OUTPUT);
  digitalWrite(MAGNET_PIN, LOW);

  // Khởi tạo I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  Serial.println("[I2C] SDA = GPIO21 | SCL = GPIO22");
  Serial.printf("[I2C] Checking 0x40... %s\n", checkI2CAddress(PCA1_ADDR) ? "OK" : "NOT FOUND");
  Serial.printf("[I2C] Checking 0x41... %s\n", checkI2CAddress(PCA2_ADDR) ? "OK" : "NOT FOUND");

  // Khởi tạo Mạch PWM Driver PCA9685
  pca1.begin();
  pca2.begin();
  pca1.setPWMFreq(SERVO_FREQUENCY);
  pca2.setPWMFreq(SERVO_FREQUENCY);
  delay(10);

  // Đặt trạng thái ban đầu cho 20 Servo
  for (uint8_t i = 0; i < ELECTRON_COUNT; i++) {
    electronCurrent[i] = false;
    electronTarget[i] = false;
    setLogicalChannel(ELECTRON_CHANNELS[i], PULSE_LOWER_US);
  }
  Serial.println("[SERVO] Setting all 20 servos DOWN...");

  // Kết nối WiFi & Blynk
  connectWiFi();
  uint32_t wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 15000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WIFI] CONNECTED");
    Serial.print("[WIFI] IP: ");
    Serial.println(WiFi.localIP());

    Serial.println("[BLYNK] Connecting...");
    Blynk.config(auth);
    if (Blynk.connect(5000)) {
      Serial.println("[BLYNK] CONNECTED");
    } else {
      Serial.println("[BLYNK] Not connected - will retry");
    }
  }

  Serial.println("\n================================================");
  Serial.println("              MODEL A READY");
  Serial.println("================================================");
  Serial.println("V0       = RESET (Sequential)");
  Serial.println("V1-V20   = Z1-Z20");
  Serial.println("V100     = IONIC");
  Serial.println("V102     = MAGNET (Independent)");
  Serial.println("================================================");
}

// ==========================================================
// 16. MAIN LOOP
// ==========================================================
void loop() {
  Blynk.run();
  updateServoScheduler();

  // Tự động kết nối lại WiFi nếu mất kết nối
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWiFiReconnect > 5000) {
      lastWiFiReconnect = millis();
      Serial.println("[WIFI] Reconnecting...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASS);
    }
  }

  // Tự động kết nối lại Blynk nếu mất kết nối
  if (WiFi.status() == WL_CONNECTED && !Blynk.connected()) {
    if (millis() - lastBlynkReconnect > 5000) {
      lastBlynkReconnect = millis();
      Serial.println("[BLYNK] Reconnecting...");
      Blynk.connect(3000);
    }
  }
}