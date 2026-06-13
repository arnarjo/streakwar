import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { startOfWeek, subDays, format } from 'date-fns';
import { C } from '../../theme';

/** 13-week activity heatmap. A cell is lit when that day has ≥1 workout. */
export default function ActivityHeatmap({ heatmapData }: { heatmapData: Map<string, number> }) {
  const weeks = 13;
  const days = 7;
  const dayLabels = ['M', '', 'W', '', 'F', '', 'S'];
  const today = new Date();
  const startMonday = startOfWeek(subDays(today, 12 * 7), { weekStartsOn: 1 });
  const cols = useMemo(() => {
    const result: Array<Array<boolean>> = [];
    for (let w = 0; w < weeks; w++) {
      const col: boolean[] = [];
      for (let d = 0; d < days; d++) {
        const date = subDays(new Date(startMonday), -(w * 7 + d));
        const dateStr = date > today ? '' : format(date, 'yyyy-MM-dd');
        col.push(dateStr ? (heatmapData.get(dateStr) ?? 0) > 0 : false);
      }
      result.push(col);
    }
    return result;
  }, [heatmapData]);

  return (
    <View style={heat.container}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ marginRight: 4 }}>
          {dayLabels.map((d, i) => (
            <Text key={i} style={heat.dayLabel}>{d}</Text>
          ))}
        </View>
        <View style={{ flex: 1, flexDirection: 'row', gap: 3 }}>
          {Array.from({ length: weeks }).map((_, wi) => (
            <View key={wi} style={{ flex: 1, gap: 3 }}>
              {Array.from({ length: days }).map((_, di) => (
                <View key={di} style={[heat.cell, { opacity: cols[wi]?.[di] ? 1 : 0.15 }]} />
              ))}
            </View>
          ))}
        </View>
      </View>
      <View style={heat.legend}>
        <Text style={heat.legendText}>Less</Text>
        {[0.15, 0.35, 0.55, 0.75, 1].map((o, i) => (
          <View key={i} style={[heat.legendDot, { opacity: o }]} />
        ))}
        <Text style={heat.legendText}>More</Text>
      </View>
    </View>
  );
}

const heat = StyleSheet.create({
  container: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: C.border },
  dayLabel: { height: 14, fontSize: 9, fontWeight: '600', color: C.muted, textAlignVertical: 'center' },
  cell: { aspectRatio: 1, borderRadius: 3, backgroundColor: C.primary },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'flex-end' },
  legendDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: C.primary },
  legendText: { fontSize: 10, color: C.muted },
});
