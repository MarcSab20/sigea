# Architecture IoT SIGEA — Recommandations capteurs aéronefs FAC

## Capteurs recommandés par aéronef

### Pack de base (tous aéronefs)
| Capteur | Modèle recommandé | Données collectées |
|---------|-------------------|-------------------|
| GPS/GNSS | u-blox NEO-M9N | Lat, Long, Altitude GPS, Vitesse sol |
| Baromètre | BMP388 | Altitude barométrique, Pression atmosphérique |
| Accéléromètre/IMU | MPU-9250 | Accélération 3 axes, Gyroscope, Cap magnétique |
| Thermomètre | DS18B20 | Température extérieure, Température cabine |
| Tachymètre turbine | Capteur Hall | RPM moteur(s) |

### Pack étendu (C-130, MI-17)
| Capteur | Données |
|---------|---------|
| Débitmètre carburant | Consommation L/h, autonomie restante |
| Capteur charge utile | Masse totale embarquée (kg) |
| Capteur vibrations | Détection anomalies structurelles |
| ADS-B transpondeur | Position broadcast pour contrôle aérien |

### Architecture transmission
- **Protocole bord** : CAN Bus ou ARINC 429 → microcontrôleur ESP32/STM32
- **Transmission sol** : 4G/LTE prioritaire, VHF data link en fallback
- **Fréquence** : 1 point GPS/sec en vol, 10 sec au sol
- **Sécurité** : chiffrement AES-256, authentification certificat par aéronef
- **Stockage bord** : SD card black-box en cas de perte signal

### Données temps réel SIGEA
```json
{
  "aeronef_id": "TJ-AAF",
  "timestamp": "2026-06-04T10:30:00Z",
  "position": { "lat": 3.8480, "lng": 11.5021, "alt_m": 7500 },
  "vitesse_kmh": 480,
  "cap_deg": 045,
  "pression_hpa": 760,
  "temp_ext_c": -15,
  "carburant_kg": 12400,
  "masse_utile_kg": 8200,
  "statut": "EN_VOL"
}
```