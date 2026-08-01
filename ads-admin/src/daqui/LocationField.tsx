import { useState } from 'react';
import { View } from 'react-native';
import LocationAutocompleteInput from '@daqui/components/LocationAutocompleteInput';
import LocationPickerModal from '@daqui/components/LocationPickerModal';

export interface PickedLocation {
  label: string;
  latitude: number;
  longitude: number;
}

// Campo de local do painel — é o MESMO componente que o app Daqui usa na aba
// "Novo post" (LocationAutocompleteInput + LocationPickerModal), só que ligado
// ao ads-backend e sem restrição de bairro: o time de anúncios marca o pin de
// um anúncio em qualquer lugar do país.

const BRAZIL_CENTER = { latitude: -15.7797, longitude: -47.9297 };

export function LocationField({
  value,
  onChange,
}: {
  value: PickedLocation | null;
  onChange: (next: PickedLocation | null) => void;
}) {
  const [text, setText] = useState('');
  const [mapOpen, setMapOpen] = useState(false);

  const confirm = (label: string, coords?: { latitude: number; longitude: number }) => {
    if (!coords) return;
    onChange({ label, latitude: coords.latitude, longitude: coords.longitude });
    setText(label);
  };

  return (
    <div className="daqui-field">
      <View>
        <LocationAutocompleteInput
          value={value ? value.label : text}
          onChangeText={(v) => {
            setText(v);
            if (value) onChange(null);
          }}
          onSelect={() => {
            /* o local só vale com coordenadas — ver onSelectResult */
          }}
          onSelectResult={(r) => confirm(r.label, { latitude: r.latitude, longitude: r.longitude })}
          onPickOnMap={() => setMapOpen(true)}
          status={value ? 'valid' : 'idle'}
          placeholder="Buscar endereço ou local..."
          emptyHint="Nenhum endereço encontrado."
          validHint="Local do pin confirmado"
        />
      </View>

      {value && (
        <div className="meta-row">
          <span>
            {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
          </span>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              onChange(null);
              setText('');
            }}
          >
            Limpar
          </button>
        </div>
      )}

      <LocationPickerModal
        visible={mapOpen}
        onClose={() => setMapOpen(false)}
        onConfirm={(address, coords) => {
          confirm(address, coords);
          setMapOpen(false);
        }}
        initialCenter={value ?? BRAZIL_CENTER}
        // Sem bairro: qualquer ponto do país é válido pra um anúncio.
        neighborhood={null}
        initialZoom={value ? 16 : 5}
      />
    </div>
  );
}
