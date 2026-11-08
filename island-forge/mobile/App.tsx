// Island Forge mobile (React Native / Expo): pick an island type, prompt an AI through your
// Island Forge server (or generate offline on the phone), browse the map, devices and Verse,
// and share the map spec to open on a computer.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Share, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import {
  MODE_LIST, MODE_CATEGORIES, MODES, DEVICE_MAP, catalogEntry, generateProcedural, generateVerseFiles, heightAt, featureStyle, TEAM_COLORS, LAND_THRESHOLD, gridRef,
  type MapSpec,
} from '../core/src/index.ts';

const C = { bg: '#0b0c24', panel: '#1d2056', panel2: '#272c6e', line: 'rgba(255,255,255,0.12)', text: '#f4f5ff', mute: '#a9addb', sun: '#ffd60a', sunInk: '#1b1b3a', bad: '#ff6b6b', ok: '#58e08a' };
const BIOME: Record<string, string> = {
  grassland: '#6fbf4a', forest: '#38873a', desert: '#e3c27a', snow: '#ecf2f7', swamp: '#60703c', jungle: '#2a9a52',
  volcanic: '#4e3e3c', beach: '#f0dc9a', mountain: '#8d8a83', urban: '#9aa3ad', autumn: '#d6893a', candy: '#f59ac8',
};
const PROVIDERS = [
  { id: 'offline', label: 'Offline (on phone)' },
  { id: 'anthropic', label: 'Claude' },
  { id: 'openai', label: 'ChatGPT' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'grok', label: 'Grok' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'llama', label: 'Llama' },
  { id: 'ollama', label: 'Ollama' },
];
type Tab = 'map' | 'places' | 'devices' | 'verse';

function biomeAt(spec: MapSpec, x: number, y: number): string {
  let best = spec.base_biome;
  let w = 0.35;
  for (const b of spec.biomes) {
    const t = 1 - Math.hypot(x - b.x, y - b.y) / b.radius;
    if (t > w) {
      w = t;
      best = b.type;
    }
  }
  return BIOME[best] || BIOME.grassland;
}

function MapView({ spec, size }: { spec: MapSpec; size: number }) {
  const N = 40;
  const cells = useMemo(() => {
    const out: { i: number; j: number; color: string }[] = [];
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const x = (i + 0.5) / N;
        const y = (j + 0.5) / N;
        const h = heightAt(spec, x, y);
        if (h > LAND_THRESHOLD) out.push({ i, j, color: h < LAND_THRESHOLD + 0.05 ? BIOME.beach : biomeAt(spec, x, y) });
      }
    return out;
  }, [spec]);
  const cell = size / N;
  const s = size / 1000;
  return (
    <Svg width={size} height={size}>
      <Rect x={0} y={0} width={size} height={size} fill="#1e5aa8" />
      {cells.map((c) => <Rect key={`${c.i}-${c.j}`} x={c.i * cell} y={c.j * cell} width={cell + 0.6} height={cell + 0.6} fill={c.color} />)}
      {spec.rivers.map((r, k) => <Polyline key={`r${k}`} points={r.points.map((p) => `${p.x * size},${p.y * size}`).join(' ')} stroke="#3aa4d6" strokeWidth={9 * s} fill="none" />)}
      {spec.roads.map((r, k) => <Polyline key={`d${k}`} points={r.points.map((p) => `${p.x * size},${p.y * size}`).join(' ')} stroke="#f5ebd2" strokeWidth={4 * s} fill="none" />)}
      {spec.storm.phases.length > 0 && <Circle cx={spec.storm.final_x * size} cy={spec.storm.final_y * size} r={14 * s} stroke="#be78ff" strokeWidth={4 * s} fill="none" />}
      {spec.bus_route && <Line x1={spec.bus_route.start.x * size} y1={spec.bus_route.start.y * size} x2={spec.bus_route.end.x * size} y2={spec.bus_route.end.y * size} stroke="#fff" strokeDasharray="8,6" strokeWidth={3 * s} />}
      {spec.features.map((f, k) => (
        <Circle key={`f${k}`} cx={f.x * size} cy={f.y * size} r={11 * s} fill={featureStyle(f.type).color} stroke={f.team ? TEAM_COLORS[f.team] : '#fff'} strokeWidth={2.5 * s} />
      ))}
      {spec.pois.map((p, k) => (
        <G key={`p${k}`}>
          <Circle cx={p.x * size} cy={p.y * size} r={({ small: 18, medium: 26, large: 36 }[p.size]) * s} fill="rgba(255,255,255,0.2)" stroke="#fff" strokeWidth={2 * s} />
          <SvgText x={p.x * size} y={p.y * size - 40 * s} fontSize={Math.max(9, 17 * s)} fontWeight="900" fill="#fff" stroke="#0a0c1e" strokeWidth={0.6} textAnchor="middle">
            {p.name.toUpperCase()}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}

export default function App() {
  const [mode, setMode] = useState('reload');
  const [prompt, setPrompt] = useState('Frozen volcano island with a neon city and pirate docks');
  const [provider, setProvider] = useState('offline');
  const [server, setServer] = useState('http://localhost:5173');
  const [apiKey, setApiKey] = useState('');
  const [spec, setSpec] = useState<MapSpec>(() => generateProcedural('Frozen volcano island with a neon city and pirate docks', 'reload'));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState<Tab>('map');
  const [showModes, setShowModes] = useState(false);
  const [verseIndex, setVerseIndex] = useState(0);
  const [width, setWidth] = useState(360);
  const verse = useMemo(() => generateVerseFiles(spec), [spec]);

  useEffect(() => setVerseIndex(0), [spec]);

  const generate = async () => {
    setStatus('');
    if (provider === 'offline') {
      setSpec(generateProcedural(prompt, mode, (Math.random() * 2 ** 32) >>> 0));
      setStatus('Generated on your phone.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${server.replace(/\/+$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, mode, provider, apiKey: apiKey || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setSpec(data.spec);
      setStatus(`Done — ${data.spec.pois.length} locations.`);
    } catch (e: any) {
      setStatus(`${e?.message || 'Failed'}. Is the server running and reachable from your phone?`);
    } finally {
      setBusy(false);
    }
  };

  const share = () => Share.share({ title: `${spec.name}.island.json`, message: JSON.stringify(spec) });
  const shareVerse = () => Share.share({ title: verse[verseIndex].path, message: verse[verseIndex].code });

  return (
    <SafeAreaView style={st.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={st.scroll} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Text style={st.brand}>ISLAND FORGE</Text>
        <Text style={st.mute}>{MODE_LIST.length} island types · AI → UEFN</Text>

        <View style={st.panel}>
          <Text style={st.label}>Island type</Text>
          <Pressable style={st.modeBtn} onPress={() => setShowModes(!showModes)} accessibilityRole="button">
            <Text style={st.modeTitle}>{MODES[mode].label}</Text>
            <Text style={st.mute} numberOfLines={2}>{MODES[mode].blurb}</Text>
          </Pressable>
          {showModes &&
            MODE_CATEGORIES.map((cat) => (
              <View key={cat} style={{ marginTop: 10 }}>
                <Text style={st.label}>{cat}</Text>
                <View style={st.wrap}>
                  {MODE_LIST.filter((m) => m.category === cat).map((m) => (
                    <Pressable key={m.id} onPress={() => { setMode(m.id); setShowModes(false); }} style={[st.chip, m.id === mode && st.chipOn]}>
                      <Text style={[st.chipText, m.id === mode && { color: C.sunInk }]}>{m.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

          <Text style={[st.label, { marginTop: 14 }]}>Describe your island</Text>
          <TextInput style={[st.input, { minHeight: 80 }]} multiline value={prompt} onChangeText={setPrompt} placeholderTextColor={C.mute} />

          <Text style={[st.label, { marginTop: 14 }]}>AI</Text>
          <View style={st.wrap}>
            {PROVIDERS.map((p) => (
              <Pressable key={p.id} onPress={() => setProvider(p.id)} style={[st.chip, provider === p.id && st.chipOn]}>
                <Text style={[st.chipText, provider === p.id && { color: C.sunInk }]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
          {provider !== 'offline' && (
            <>
              <TextInput style={st.input} value={server} onChangeText={setServer} autoCapitalize="none" placeholder="Server URL (your computer's IP)" placeholderTextColor={C.mute} />
              <TextInput style={st.input} value={apiKey} onChangeText={setApiKey} autoCapitalize="none" secureTextEntry placeholder="API key (optional if set on the server)" placeholderTextColor={C.mute} />
            </>
          )}
          <Pressable style={[st.primary, busy && { opacity: 0.6 }]} disabled={busy} onPress={generate} accessibilityRole="button">
            {busy ? <ActivityIndicator color={C.sunInk} /> : <Text style={st.primaryText}>GENERATE ISLAND</Text>}
          </Pressable>
          {!!status && <Text style={[st.mute, { marginTop: 8 }]}>{status}</Text>}
        </View>

        <View style={st.panel}>
          <Text style={st.title}>{spec.name.toUpperCase()}</Text>
          <Text style={st.mute}>{MODES[spec.mode].label} · {spec.pois.length} locations · {spec.features.length} features · {spec.devices.length} devices</Text>
          <View style={[st.wrap, { marginVertical: 10 }]}>
            {(['map', 'places', 'devices', 'verse'] as Tab[]).map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} style={[st.chip, tab === t && st.tabOn]}>
                <Text style={[st.chipText, tab === t && { color: C.sunInk }]}>{t[0].toUpperCase() + t.slice(1)}</Text>
              </Pressable>
            ))}
          </View>

          {tab === 'map' && <MapView spec={spec} size={Math.max(240, width - 64)} />}
          {tab === 'places' &&
            spec.pois.map((p, i) => (
              <View key={i} style={st.row}>
                <Text style={st.rowTitle}>{p.name}</Text>
                <Text style={st.mute}>{p.kind} · {p.size} · {'★'.repeat(p.loot_tier)} · {gridRef(p.x, p.y)}</Text>
                <Text style={st.mute}>Prefab: {p.prefab ? catalogEntry(p.prefab)?.name : 'build by hand'}{p.galleries.length ? ` · Galleries: ${p.galleries.map((g) => catalogEntry(g)?.name || g).join(', ')}` : ''}</Text>
              </View>
            ))}
          {tab === 'devices' &&
            Object.entries(spec.devices.reduce<Record<string, number>>((acc, d) => ((acc[d.device] = (acc[d.device] || 0) + 1), acc), {})).map(([id, n]) => (
              <View key={id} style={st.row}>
                <Text style={st.rowTitle}>{DEVICE_MAP[id]?.name || id} × {n}</Text>
                <Text style={st.mute}>{DEVICE_MAP[id]?.description}</Text>
              </View>
            ))}
          {tab === 'verse' && (
            <View>
              <View style={st.wrap}>
                {verse.map((f, i) => (
                  <Pressable key={f.path} onPress={() => setVerseIndex(i)} style={[st.chip, i === verseIndex && st.chipOn]}>
                    <Text style={[st.chipText, i === verseIndex && { color: C.sunInk }]}>{f.title}</Text>
                  </Pressable>
                ))}
              </View>
              <ScrollView horizontal style={st.code}>
                <Text style={st.codeText}>{verse[verseIndex]?.code}</Text>
              </ScrollView>
              <Pressable style={st.secondary} onPress={shareVerse}><Text style={st.chipText}>Share this .verse file</Text></Pressable>
            </View>
          )}
          <Pressable style={st.secondary} onPress={share}>
            <Text style={st.chipText}>Share map spec (open it in the web app to export for UEFN)</Text>
          </Pressable>
        </View>
        <Text style={[st.mute, { textAlign: 'center', fontSize: 11 }]}>Not affiliated with or endorsed by Epic Games.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 14 },
  brand: { color: C.text, fontSize: 26, fontWeight: '900', letterSpacing: 1 },
  title: { color: C.text, fontSize: 20, fontWeight: '900' },
  mute: { color: C.mute, fontSize: 13 },
  panel: { backgroundColor: C.panel, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14 },
  label: { color: C.mute, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  modeBtn: { backgroundColor: C.panel2, borderRadius: 12, padding: 12 },
  modeTitle: { color: C.text, fontWeight: '900', fontSize: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.05)' },
  chipOn: { backgroundColor: C.sun, borderColor: C.sun },
  tabOn: { backgroundColor: C.text },
  chipText: { color: C.text, fontWeight: '700', fontSize: 13 },
  input: { backgroundColor: '#12143a', color: C.text, borderRadius: 10, borderWidth: 1, borderColor: C.line, padding: 10, marginTop: 8, textAlignVertical: 'top' },
  primary: { backgroundColor: C.sun, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 14 },
  primaryText: { color: C.sunInk, fontWeight: '900', fontSize: 17 },
  secondary: { borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 12 },
  row: { borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8 },
  rowTitle: { color: C.text, fontWeight: '700' },
  code: { backgroundColor: '#0b0d2c', borderRadius: 10, padding: 10, marginTop: 10, maxHeight: 420 },
  codeText: { color: '#d7dbff', fontFamily: 'Courier', fontSize: 11 },
});
