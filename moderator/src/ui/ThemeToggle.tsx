import { useThemeMode } from '../lib/theme';
import { Icon } from './Icon';

export function ThemeToggle() {
  const { mode, toggle } = useThemeMode();
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggle}
      title="Alternar tema"
      aria-label="Alternar tema"
    >
      <Icon name={mode === 'dark' ? 'sun' : 'moon'} size={16} />
    </button>
  );
}
