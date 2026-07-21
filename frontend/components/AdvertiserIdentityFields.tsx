import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { AdvertiserType } from '../lib/adsApi';
import { maskDocument, isValidDocument, onlyDigits } from '../lib/brDocuments';

// Bloco "quem está anunciando": alterna entre Pessoa Física (CPF) e Pessoa
// Jurídica (CNPJ). O rótulo do nome e a máscara/validação do documento mudam
// conforme o tipo. Reaproveitado no checkout e na edição pelo anunciante.

interface Props {
  type: AdvertiserType;
  name: string;
  document: string;
  onChangeType: (t: AdvertiserType) => void;
  onChangeName: (v: string) => void;
  onChangeDocument: (v: string) => void;
}

const OPTIONS: { key: AdvertiserType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'individual', label: 'Pessoa Física', icon: 'person-outline' },
  { key: 'company', label: 'Pessoa Jurídica', icon: 'business-outline' },
];

export default function AdvertiserIdentityFields({
  type, name, document, onChangeType, onChangeName, onChangeDocument,
}: Props) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const isCompany = type === 'company';
  const docFilled = onlyDigits(document).length > 0;
  const docValid = isValidDocument(type, document);

  const switchType = (next: AdvertiserType) => {
    if (next === type) return;
    onChangeType(next);
    // Reaplica a máscara do novo tipo sobre os dígitos já digitados.
    onChangeDocument(maskDocument(next, document));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.segment}>
        {OPTIONS.map((o) => {
          const active = o.key === type;
          return (
            <TouchableOpacity
              key={o.key}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              activeOpacity={0.85}
              onPress={() => switchType(o.key)}
            >
              <Ionicons name={o.icon} size={16} color={active ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TextInput
        style={styles.input}
        placeholder={isCompany ? 'Razão social / nome da empresa' : 'Nome completo'}
        placeholderTextColor={Colors.textTertiary}
        value={name}
        onChangeText={onChangeName}
      />

      <TextInput
        style={[styles.input, docFilled && !docValid && styles.inputError]}
        placeholder={isCompany ? 'CNPJ' : 'CPF'}
        placeholderTextColor={Colors.textTertiary}
        value={document}
        onChangeText={(v) => onChangeDocument(maskDocument(type, v))}
        keyboardType="numeric"
      />
      {docFilled && !docValid && (
        <Text style={styles.errorText}>{isCompany ? 'CNPJ inválido' : 'CPF inválido'}</Text>
      )}
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  wrap: { gap: 10 },
  segment: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 12,
    backgroundColor: Colors.borderLight,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentBtnActive: { backgroundColor: Colors.primary },
  segmentText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  segmentTextActive: { color: '#fff' },

  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.surface,
    outlineStyle: 'none',
  } as any,
  inputError: { borderColor: Colors.error },
  errorText: { fontSize: 12, fontWeight: '600', color: Colors.error, marginTop: -4 },
});
