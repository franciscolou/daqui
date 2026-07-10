import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { api, ApiError, NearbyNeighborhood } from '../lib/api';
import { getDeviceCoords, LocationError } from '../lib/location';
import { useAuth } from '../lib/auth';

type GeoStatus = 'locating' | 'resolved' | 'error';

const formatDistance = (meters: number) =>
  meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;

/**
 * Configuração do "Meu bairro": descobre o bairro atual por GPS e deixa o
 * usuário aceitar ou escolher um bairro nas redondezas (diferente do cadastro,
 * aqui a escolha manual é permitida — é o bairro onde o usuário diz morar).
 */
export default function HomeNeighborhoodSetup({ onConfigured }: { onConfigured?: () => void }) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { refresh } = useAuth();

  const [geoStatus, setGeoStatus] = useState<GeoStatus>('locating');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('São Paulo');
  const [uf, setUf] = useState('SP');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nearby, setNearby] = useState<NearbyNeighborhood[] | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyOpen, setNearbyOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const detectLocation = useCallback(async () => {
    setError(null);
    setGeoStatus('locating');
    setNearby(null);
    setNearbyLoading(false);
    setNearbyOpen(false);
    try {
      const c = await getDeviceCoords();
      const res = await api.resolveNeighborhood(c.latitude, c.longitude);
      setNeighborhood(res.neighborhood);
      setCity(res.city);
      setUf(res.state);
      setCoords({ latitude: res.latitude, longitude: res.longitude });
      setGeoStatus('resolved');
    } catch (e) {
      setGeoStatus('error');
      if (e instanceof LocationError) {
        setError(
          e.reason === 'denied'
            ? 'Permita o acesso à localização para descobrirmos seu bairro.'
            : 'Não conseguimos obter sua localização. Tente novamente.',
        );
      } else if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('Não foi possível identificar seu bairro.');
      }
    }
  }, []);

  useEffect(() => {
    detectLocation();
  }, [detectLocation]);

  const openNearby = async () => {
    if (!coords) return;
    setNearbyOpen(true);
    if (nearby !== null || nearbyLoading) return;
    setNearbyLoading(true);
    try {
      const list = await api.nearbyNeighborhoods(coords.latitude, coords.longitude);
      setNearby(list);
    } catch {
      setNearby([]);
    } finally {
      setNearbyLoading(false);
    }
  };

  const chooseNearby = (n: NearbyNeighborhood) => {
    setNeighborhood(n.neighborhood);
    setCoords({ latitude: n.latitude, longitude: n.longitude });
    setNearbyOpen(false);
  };

  const confirm = async () => {
    if (submitting || !coords) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await api.updateProfile({
        neighborhood,
        city,
        state: uf,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      await refresh();
      onConfigured?.();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : 'Não foi possível salvar seu bairro.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Configure seu bairro</Text>
      <Text style={styles.subtitle}>
        Diga onde você mora para ver e participar da sua comunidade.
      </Text>

      <View style={styles.geoArea}>
        {geoStatus === 'locating' && (
          <>
            <View style={styles.geoSpinnerWrap}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
            <Text style={styles.geoLocatingTitle}>Descobrindo seu bairro…</Text>
            <Text style={styles.geoLocatingDesc}>
              Estamos usando a localização do seu aparelho para encontrar sua comunidade.
            </Text>
          </>
        )}

        {geoStatus === 'resolved' && (
          <>
            <View style={styles.emblemWrap}>
              <LinearGradient colors={Colors.gradient.primary} style={styles.emblem}>
                <Ionicons name="location" size={40} color="#fff" />
              </LinearGradient>
              <View style={styles.emblemPulse} />
            </View>
            <Text style={styles.geoEyebrow}>Você está em</Text>
            <Text style={styles.geoNeighborhood}>{neighborhood}</Text>
            <Text style={styles.geoCity}>{city}{uf ? ` - ${uf}` : ''}</Text>

            {/* <View style={styles.hintBox}>
              <Ionicons name="information-circle" size={18} color={Colors.primaryDark} />
              <Text style={styles.hintText}>
                Se esse não for o bairro onde você mora, escolha um nas redondezas abaixo.
              </Text>
            </View> */}
          </>
        )}

        {geoStatus === 'error' && (
          <>
            <View style={styles.geoErrorIcon}>
              <Ionicons name="location-outline" size={34} color={Colors.error} />
            </View>
            <Text style={styles.geoLocatingTitle}>Não encontramos seu bairro</Text>
            <Text style={styles.geoLocatingDesc}>
              {error ?? 'Verifique a permissão de localização e tente novamente.'}
            </Text>
          </>
        )}
      </View>

      {submitError && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color={Colors.error} />
          <Text style={styles.errorText}>{submitError}</Text>
        </View>
      )}

      {geoStatus === 'locating' ? (
        <View style={[styles.btnPrimary, styles.btnDisabled]}>
          <View style={styles.btnGradientPlain}>
            <ActivityIndicator color="#fff" />
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.btnPrimary, submitting && styles.btnDisabled]}
          onPress={geoStatus === 'resolved' ? confirm : detectLocation}
          activeOpacity={0.85}
          disabled={submitting}
        >
          <LinearGradient
            colors={Colors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnGradient}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.btnText}>
                  {geoStatus === 'resolved' ? 'Sim, esse é meu bairro' : 'Tentar novamente'}
                </Text>
                <Ionicons name={geoStatus === 'resolved' ? 'checkmark' : 'arrow-forward'} size={18} color="#fff" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}

      {geoStatus === 'resolved' && (
        <View style={styles.nearbyArea}>
          {nearbyLoading ? (
            <View style={styles.nearbyLoading}>
              <ActivityIndicator color={Colors.primary} size="small" />
              <Text style={styles.nearbyLoadingText}>Buscando bairros vizinhos…</Text>
            </View>
          ) : nearbyOpen && nearby !== null ? (
            <>
              <View style={styles.nearbyHeader}>
                <Text style={styles.nearbyTitle}>Bairros nas redondezas</Text>
                <TouchableOpacity onPress={() => setNearbyOpen(false)} hitSlop={8}>
                  <Text style={styles.nearbyCancel}>Cancelar</Text>
                </TouchableOpacity>
              </View>
              {(() => {
                const options = nearby
                  .filter((n) => n.neighborhood.toLowerCase() !== neighborhood.toLowerCase())
                  .sort((a, b) => a.distanceM - b.distanceM);
                return options.length === 0 ? (
                  <Text style={styles.nearbyEmpty}>
                    Não encontramos bairros vizinhos por aqui.
                  </Text>
                ) : (
                  <View style={styles.nearbyList}>
                    {options.map((n, i) => (
                      <TouchableOpacity
                        key={n.neighborhood}
                        style={styles.nearbyRow}
                        onPress={() => chooseNearby(n)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.nearbyRank}>
                          <Text style={styles.nearbyRankText}>{i + 1}</Text>
                        </View>
                        <Ionicons name="location-outline" size={15} color={Colors.primaryDark} />
                        <Text style={styles.nearbyRowText} numberOfLines={1}>{n.neighborhood}</Text>
                        <Text style={styles.nearbyRowDistance}>{formatDistance(n.distanceM)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })()}
            </>
          ) : (
            <TouchableOpacity style={styles.nearbyToggle} onPress={openNearby} activeOpacity={0.7}>
              <Ionicons name="navigate-outline" size={15} color={Colors.primaryDark} />
              <Text style={styles.nearbyToggleText}>
                Não é seu bairro? Informe-nos um bairro nas redondezas
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 12,
  },

  geoArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
  },
  geoSpinnerWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  geoLocatingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  geoLocatingDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  emblemWrap: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblem: {
    width: 96,
    height: 96,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    ...Colors.shadow.lg,
  },
  emblemPulse: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
    opacity: 0.6,
  },
  geoEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  geoNeighborhood: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 4,
  },
  geoCity: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 20,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.primaryFaint,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  geoErrorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.error + '12',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.error, fontWeight: '500' },

  btnPrimary: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
    ...Colors.shadow.md,
  },
  btnDisabled: { opacity: 0.7 },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  btnGradientPlain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: Colors.primary,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  nearbyArea: { marginTop: 8 },
  nearbyToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 8 },
  nearbyToggleText: { fontSize: 13, color: Colors.primaryDark, fontWeight: '600', textAlign: 'center' },
  nearbyLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  nearbyLoadingText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  nearbyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  nearbyTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  nearbyCancel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  nearbyEmpty: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  nearbyList: { gap: 8 },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryFaint,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  nearbyRank: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  nearbyRankText: { fontSize: 11, fontWeight: '800', color: Colors.primaryDark },
  nearbyRowText: { flex: 1, fontSize: 13, color: Colors.primaryDark, fontWeight: '600' },
  nearbyRowDistance: { fontSize: 12, color: Colors.primaryDark, fontWeight: '600', opacity: 0.75 },
});
