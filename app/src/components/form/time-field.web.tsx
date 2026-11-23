import { formatTime, withTime } from '@/components/form/format-time';
import { Icon, type IconName } from '@/components/icon';
import type { ThemeColor } from '@/constants/theme';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TimeFieldProps = {
  /** Accessible name, e.g. "Start time". */
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  invalid?: boolean;
  /** Small label at the top of the box. */
  caption?: string;
  /** Icon on the left of the time. */
  icon?: IconName;
  iconColor?: ThemeColor;
};

export { formatTime };

/**
 * Time of day on the web. The native picker package has no web implementation (it renders nothing),
 * so this uses the browser's own time input, in a box like the app's: a caption on top, an icon on the left.
 */
export function TimeField({
  label,
  value,
  onChange,
  invalid,
  caption,
  icon,
  iconColor = 'tint',
}: TimeFieldProps) {
  const theme = useTheme();

  return (
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        width: '100%',
        padding: 8,
        borderRadius: 8,
        border: `1px solid ${invalid ? theme.danger : theme.border}`,
        backgroundColor: theme.inputFill,
      }}>
      {caption && (
        <span
          style={{
            color: theme.textSecondary,
            fontFamily: `${FontFamily.headlineSemi}, system-ui, sans-serif`,
            fontSize: 10,
            lineHeight: '14px',
          }}>
          {caption}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <Icon name={icon} size={20} color={iconColor} />}
        <input
          type="time"
          aria-label={label}
          aria-invalid={invalid || undefined}
          value={formatTime(value)}
          onChange={(event) => {
            // Empty while the user is mid-edit or clears the field: keep the last valid time.
            const next = withTime(value, event.target.value);
            if (next) onChange(next);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: theme.text,
            fontFamily: `${FontFamily.headline}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
            fontSize: 16,
            padding: 0,
            textAlign: 'right',
          }}
        />
      </div>
    </div>
  );
}
