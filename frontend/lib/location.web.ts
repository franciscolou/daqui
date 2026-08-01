// Versão web de `lib/location.ts`: mesma API pública, sem passar pelo
// expo-location. Na web o expo-location é só um wrapper de
// `navigator.geolocation`, e falar direto com o navegador deixa este módulo
// (e tudo que depende dele — NeighborhoodPicker, CityPicker) utilizável em
// bundles que não têm o runtime do Expo, como os painéis ads-admin/moderator.

export interface Coords {
  latitude: number;
  longitude: number;
}

// Distância em metros entre dois pontos (fórmula de haversine).
export function haversineMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// Erro tipado para a UI diferenciar "permissão negada" de "indisponível".
export class LocationError extends Error {
  reason: 'denied' | 'unavailable';
  constructor(reason: 'denied' | 'unavailable', message: string) {
    super(message);
    this.reason = reason;
  }
}

/**
 * Pede permissão e devolve as coordenadas atuais do dispositivo.
 * O próprio `navigator.geolocation` cuida do prompt de permissão do navegador:
 * `PERMISSION_DENIED` (código 1) vira `denied`, o resto vira `unavailable`.
 */
export async function getDeviceCoords(): Promise<Coords> {
  const geolocation =
    typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
  if (!geolocation) {
    throw new LocationError('unavailable', 'Não foi possível acessar a localização.');
  }

  return new Promise<Coords>((resolve, reject) => {
    geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        if (err && err.code === 1) {
          reject(
            new LocationError(
              'denied',
              'Precisamos da sua localização para descobrir seu bairro.',
            ),
          );
        } else {
          reject(
            new LocationError('unavailable', 'Não foi possível obter sua localização agora.'),
          );
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}
