import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  describePlace,
  distanceKm,
  FarFromLleidaKm,
  getDeviceLocation,
  LleidaCentre,
} from '@/features/preferences/location';
import type { GeoPoint } from '@/types/api';

type StartLocationFieldProps = {
  value: GeoPoint | undefined;
  onChange: (value: GeoPoint | undefined) => void;
  /** Max distance in km. */
  radiusKm: number;
};

/**
 * Where the group starts, on the web. react-native-maps has no web implementation (importing it crashes
 * the whole bundle), so there is no map here: the start is set from the browser's location, or the
 * city centre. The native version in start-location-field.tsx has the map.
 */
export function StartLocationField({ value, onChange, radiusKm }: StartLocationFieldProps) {
  const [named, setNamed] = useState<{ point: GeoPoint; name: string | undefined }>();
  const [message, setMessage] = useState<string>();
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!value) return;
    let current = true;
    // describePlace never rejects (it resolves to undefined on failure).
    void describePlace(value).then((name) => {
      if (current) setNamed({ point: value, name });
    });
    return () => {
      current = false;
    };
  }, [value]);
  const place = named?.point === value ? named?.name : undefined;

  async function locateMe() {
    setLocating(true);
    const result = await getDeviceLocation();
    setLocating(false);
    if ('error' in result) {
      setMessage(result.error);
    } else {
      setMessage(undefined);
      onChange(result.point);
    }
  }

  const far = value !== undefined && distanceKm(value, LleidaCentre) > FarFromLleidaKm;

  return (
    <View style={styles.field}>
      <ThemedText type="caption" themeColor="textSecondary" accessibilityLiveRegion="polite">
        {value
          ? `Starting at ${place ?? `${value.latitude.toFixed(4)}, ${value.longitude.toFixed(4)}`}. Venues within ${radiusKm} km.`
          : "The map is only available in the mobile app. Use your location or the city centre to set where you start. Without a start point, distance isn't used."}
      </ThemedText>
      {far && (
        <ThemedText type="small" themeColor="danger">
          That&apos;s far from Lleida. LinkUp only knows venues in Lleida, so you may get no plans.
        </ThemedText>
      )}
      {message && (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}

      <View style={styles.actions}>
        <Button
          title={locating ? 'Finding you…' : 'Use my location'}
          icon="navigate-outline"
          variant="secondary"
          disabled={locating}
          onPress={locateMe}
          style={styles.action}
        />
        <Button
          title="Lleida centre"
          variant="secondary"
          onPress={() => {
            setMessage(undefined);
            onChange(LleidaCentre);
          }}
          style={styles.action}
        />
        {value && (
          <Button
            title="Clear"
            variant="secondary"
            onPress={() => onChange(undefined)}
            style={styles.action}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  action: {
    flexGrow: 1,
  },
});
