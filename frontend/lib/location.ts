import * as Location from 'expo-location';

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
 * Funciona na web (via navigator.geolocation, exposto pelo expo-location).
 */
export async function getDeviceCoords(): Promise<Coords> {
  let status: Location.PermissionStatus;
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    status = perm.status;
  } catch {
    throw new LocationError('unavailable', 'Não foi possível acessar a localização.');
  }

  if (status !== 'granted') {
    throw new LocationError(
      'denied',
      'Precisamos da sua localização para descobrir seu bairro.',
    );
  }

  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    throw new LocationError('unavailable', 'Não foi possível obter sua localização agora.');
  }
}
