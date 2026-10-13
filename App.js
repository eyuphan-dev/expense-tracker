import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// ---------- Sabitler ----------
const STORAGE_KEY = 'gelir-gider:v1';
const PAYDAY = 10; // maaş günü: dönem her ayın 10'unda başlar

const C = {
  bg: '#0B0C0F',
  surface: '#16181D',
  surface2: '#1F2228',
  border: '#2A2E36',
  text: '#F3F4F6',
  muted: '#8B919C',
  green: '#3DDC97',
  red: '#FF6B6B',
  accent: '#7C9CFF',
};

const CATS = [
  { id: 'market', label: 'Market', icon: '🛒' },
  { id: 'fatura', label: 'Fatura', icon: '💡' },
  { id: 'kira', label: 'Kira', icon: '🏠' },
  { id: 'ulasim', label: 'Ulaşım', icon: '⛽' },
  { id: 'yemek', label: 'Yemek', icon: '🍽️' },
  { id: 'saglik', label: 'Sağlık', icon: '💊' },
  { id: 'giyim', label: 'Giyim', icon: '👕' },
  { id: 'borc', label: 'Borç/Kredi', icon: '💳' },
  { id: 'eglence', label: 'Eğlence', icon: '🎉' },
  { id: 'diger', label: 'Diğer', icon: '📦' },
];
const catById = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 1];

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const EMPTY_DATA = { salaries: [], extras: {}, expenses: [] };

// ---------- Yardımcılar ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function fmt(n) {
  const neg = n < 0;
  const v = Math.round(Math.abs(n) * 100) / 100;
  const int = Math.floor(v);
  const dec = Math.round((v - int) * 100);
  const intStr = String(int).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + intStr + (dec ? ',' + String(dec).padStart(2, '0') : '') + ' ₺';
}

function parseAmount(s) {
  let t = String(s).replace(/[\s₺]/g, '');
  if (!t) return 0;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

const amountToInput = (n) => (n ? String(n).replace('.', ',') : '');

// Tarihleri "YYYY-MM-DD" olarak saklıyoruz (saat dilimi sorunu olmasın)
const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Dönem = { y, m }: m. ayın 10'u ile (m+1). ayın 9'u arası
function periodOf(date) {
  let y = date.getFullYear();
  let m = date.getMonth();
  if (date.getDate() < PAYDAY) {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return { y, m };
}
const periodKey = (p) => `${p.y}-${String(p.m + 1).padStart(2, '0')}`;
const shiftPeriod = (p, n) => {
  const d = new Date(p.y, p.m + n, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
};
const periodStart = (p) => new Date(p.y, p.m, PAYDAY);
const periodEnd = (p) => new Date(p.y, p.m + 1, PAYDAY - 1);
const sameDay = (a, b) => toISO(a) === toISO(b);

function salaryFor(salaries, key) {
  let best = null;
  for (const s of salaries) if (s.from <= key && (!best || s.from > best.from)) best = s;
  return best ? best.amount : 0;
}

function dayLabel(iso) {
  const d = fromISO(iso);
  const today = new Date();
  const yest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (sameDay(d, today)) return 'Bugün';
  if (sameDay(d, yest)) return 'Dün';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${DAYS[d.getDay()]}`;
}

// ---------- Uygulama ----------
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(EMPTY_DATA);
  const [loaded, setLoaded] = useState(false);
  const [period, setPeriod] = useState(() => periodOf(new Date()));
  const [expenseDialog, setExpenseDialog] = useState(null); // { item? }
  const [incomeOpen, setIncomeOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setData({ ...EMPTY_DATA, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [data, loaded]);

  const key = periodKey(period);
  const currentPeriod = periodOf(new Date());
  const isCurrent = key === periodKey(currentPeriod);

  const view = useMemo(() => {
    const salary = salaryFor(data.salaries, key);
    const extras = data.extras[key] || [];
    const extraTotal = extras.reduce((s, e) => s + e.amount, 0);
    const expenses = data.expenses
      .filter((e) => periodKey(periodOf(fromISO(e.date))) === key)
      .sort((a, b) => (a.date === b.date ? b.created - a.created : a.date < b.date ? 1 : -1));
    const spent = expenses.reduce((s, e) => s + e.amount, 0);
    const income = salary + extraTotal;

    const byCat = {};
    for (const e of expenses) byCat[e.cat] = (byCat[e.cat] || 0) + e.amount;
    const cats = Object.entries(byCat)
      .map(([id, total]) => ({ ...catById(id), total }))
      .sort((a, b) => b.total - a.total);

    const groups = [];
    for (const e of expenses) {
      const last = groups[groups.length - 1];
      if (last && last.date === e.date) {
        last.items.push(e);
        last.total += e.amount;
      } else groups.push({ date: e.date, items: [e], total: e.amount });
    }

    return { salary, extras, extraTotal, spent, income, left: income - spent, cats, groups };
  }, [data, key]);

  // ---- veri işlemleri ----
  const saveExpense = (exp) =>
    setData((d) => {
      const exists = d.expenses.some((e) => e.id === exp.id);
      return {
        ...d,
        expenses: exists ? d.expenses.map((e) => (e.id === exp.id ? exp : e)) : [...d.expenses, exp],
      };
    });
  const deleteExpense = (id) => setData((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }));
  const setSalary = (amount) =>
    setData((d) => ({
      ...d,
      salaries: [...d.salaries.filter((s) => s.from !== key), { from: key, amount }],
    }));
  const addExtra = (amount, note) =>
    setData((d) => ({
      ...d,
      extras: { ...d.extras, [key]: [...(d.extras[key] || []), { id: uid(), amount, note }] },
    }));
  const deleteExtra = (id) =>
    setData((d) => ({
      ...d,
      extras: { ...d.extras, [key]: (d.extras[key] || []).filter((e) => e.id !== id) },
    }));

  if (!loaded) return <View style={styles.root} />;

  const ratio = view.income > 0 ? Math.min(view.spent / view.income, 1) : view.spent > 0 ? 1 : 0;
  const ps = periodStart(period);
  const pe = periodEnd(period);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Dönem seçici */}
        <View style={styles.periodRow}>
          <IconBtn label="‹" onPress={() => setPeriod((p) => shiftPeriod(p, -1))} />
          <Pressable style={{ alignItems: 'center', flex: 1 }} onPress={() => setPeriod(currentPeriod)}>
            <Text style={styles.periodTitle}>
              {MONTHS[period.m]} {period.y}
            </Text>
            <Text style={styles.periodSub}>
              {ps.getDate()} {MONTHS_SHORT[ps.getMonth()]} – {pe.getDate()} {MONTHS_SHORT[pe.getMonth()]}
              {isCurrent ? '  ·  bu dönem' : '  ·  bugüne dön'}
            </Text>
          </Pressable>
          <IconBtn label="›" onPress={() => setPeriod((p) => shiftPeriod(p, 1))} />
        </View>

        {/* Kalan */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>KALAN</Text>
          <Text
            style={[styles.heroValue, { color: view.left < 0 ? C.red : C.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {fmt(view.left)}
          </Text>
          <View style={styles.bar}>
            <View
              style={[
                styles.barFill,
                { width: `${ratio * 100}%`, backgroundColor: ratio >= 0.9 ? C.red : C.accent },
              ]}
            />
          </View>
          <Text style={styles.barText}>
            {view.income > 0
              ? `Gelirin %${Math.round((view.spent / view.income) * 100)}'i harcandı`
              : 'Henüz gelir girilmedi'}
          </Text>
        </View>

        {/* Gelir / Gider kartları */}
        <View style={styles.statRow}>
          <Pressable
            style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
            onPress={() => setIncomeOpen(true)}
          >
            <Text style={styles.statLabel}>Gelir  ✎</Text>
            <Text style={[styles.statValue, { color: C.green }]} numberOfLines={1} adjustsFontSizeToFit>
              {fmt(view.income)}
            </Text>
            <Text style={styles.statSub} numberOfLines={1}>
              {view.salary ? `Maaş ${fmt(view.salary)}` : 'Maaşını girmek için dokun'}
              {view.extraTotal ? ` + ${fmt(view.extraTotal)}` : ''}
            </Text>
          </Pressable>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Gider</Text>
            <Text style={[styles.statValue, { color: C.red }]} numberOfLines={1} adjustsFontSizeToFit>
              {fmt(view.spent)}
            </Text>
            <Text style={styles.statSub}>
              {view.groups.reduce((s, g) => s + g.items.length, 0)} harcama
            </Text>
          </View>
        </View>

        {/* Kategori özeti */}
        {view.cats.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Nereye gitti?</Text>
            {view.cats.map((c) => (
              <View key={c.id} style={styles.catRow}>
                <Text style={styles.catIcon}>{c.icon}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.catTop}>
                    <Text style={styles.catName}>{c.label}</Text>
                    <Text style={styles.catTotal}>{fmt(c.total)}</Text>
                  </View>
                  <View style={styles.catBar}>
                    <View style={[styles.catBarFill, { width: `${(c.total / view.spent) * 100}%` }]} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Harcama listesi */}
        {view.groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🧾</Text>
            <Text style={styles.emptyText}>Bu dönemde harcama yok</Text>
            <Text style={styles.emptySub}>Aşağıdaki + butonuyla ekleyebilirsin</Text>
          </View>
        ) : (
          view.groups.map((g) => (
            <View key={g.date} style={{ marginTop: 18 }}>
              <View style={styles.dayHead}>
                <Text style={styles.dayLabel}>{dayLabel(g.date)}</Text>
                <Text style={styles.dayTotal}>{fmt(g.total)}</Text>
              </View>
              <View style={styles.card0}>
                {g.items.map((e, i) => {
                  const c = catById(e.cat);
                  return (
                    <Pressable
                      key={e.id}
                      onPress={() => setExpenseDialog({ item: e })}
                      style={({ pressed }) => [
                        styles.item,
                        i > 0 && styles.itemBorder,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.itemIcon}>
                        <Text style={{ fontSize: 20 }}>{c.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {e.note || c.label}
                        </Text>
                        {e.note ? <Text style={styles.itemSub}>{c.label}</Text> : null}
                      </View>
                      <Text style={styles.itemAmount}>-{fmt(e.amount)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Ekle butonu */}
      <Pressable
        onPress={() => setExpenseDialog({})}
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 20 }, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.fabText}>＋  Gider Ekle</Text>
      </Pressable>

      {expenseDialog && (
        <ExpenseDialog
          item={expenseDialog.item}
          period={period}
          insets={insets}
          onClose={() => setExpenseDialog(null)}
          onSave={(exp) => {
            saveExpense(exp);
            setExpenseDialog(null);
          }}
          onDelete={(id) => {
            deleteExpense(id);
            setExpenseDialog(null);
          }}
        />
      )}

      {incomeOpen && (
        <IncomeDialog
          periodName={`${MONTHS[period.m]} ${period.y}`}
          salary={view.salary}
          extras={view.extras}
          insets={insets}
          onClose={() => setIncomeOpen(false)}
          onSetSalary={setSalary}
          onAddExtra={addExtra}
          onDeleteExtra={deleteExtra}
        />
      )}
    </View>
  );
}

// ---------- Bileşenler ----------
function IconBtn({ label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
    >
      <Text style={styles.iconBtnText}>{label}</Text>
    </Pressable>
  );
}

// Android tarzı tam ekran pencere: Kaydet üstte, klavye kapatamaz
function FullDialog({ title, onClose, onSave, saveLabel = 'Kaydet', insets, children }) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.dialogBar}>
          <IconBtn label="✕" onPress={onClose} />
          <Text style={styles.dialogTitle}>{title}</Text>
          {onSave ? (
            <Pressable onPress={onSave} hitSlop={8} style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}>
              <Text style={styles.saveBtnText}>{saveLabel}</Text>
            </Pressable>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 300 }}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

function AmountField({ value, onChangeText, autoFocus, placeholder = '0', onSubmit }) {
  return (
    <View style={styles.amountBox}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={C.border}
        style={styles.amountInput}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        selectionColor={C.accent}
      />
      <Text style={styles.amountTl}>₺</Text>
    </View>
  );
}

function ExpenseDialog({ item, period, insets, onClose, onSave, onDelete }) {
  const ps = periodStart(period);
  const pe = periodEnd(period);
  const today = new Date();
  const initialDate = item
    ? fromISO(item.date)
    : today >= ps && today <= new Date(pe.getFullYear(), pe.getMonth(), pe.getDate(), 23, 59)
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
      : ps;

  const [amount, setAmount] = useState(item ? amountToInput(item.amount) : '');
  const [cat, setCat] = useState(item ? item.cat : null);
  const [note, setNote] = useState(item ? item.note : '');
  const [date, setDate] = useState(initialDate);

  const moveDay = (n) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
    if (d >= ps && d <= pe) setDate(d);
  };

  const save = () => {
    const n = parseAmount(amount);
    if (!n) return Alert.alert('Tutar gir', 'Harcama tutarını yazmayı unuttun.');
    if (!cat) return Alert.alert('Kategori seç', 'Ne için harcadığını seç.');
    onSave({
      id: item ? item.id : uid(),
      created: item ? item.created : Date.now(),
      amount: n,
      cat,
      note: note.trim(),
      date: toISO(date),
    });
  };

  return (
    <FullDialog title={item ? 'Harcamayı Düzenle' : 'Yeni Harcama'} onClose={onClose} onSave={save} insets={insets}>
      <AmountField value={amount} onChangeText={setAmount} autoFocus={!item} onSubmit={Keyboard.dismiss} />

      <Text style={styles.fieldLabel}>Ne için?</Text>
      <View style={styles.catGrid}>
        {CATS.map((c) => {
          const on = cat === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => {
                setCat(c.id);
                Keyboard.dismiss();
              }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={styles.chipIcon}>{c.icon}</Text>
              <Text style={[styles.chipText, on && { color: C.text }]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>Tarih</Text>
      <View style={styles.dateRow}>
        <IconBtn label="‹" onPress={() => moveDay(-1)} />
        <Text style={styles.dateText}>{dayLabel(toISO(date))}</Text>
        <IconBtn label="›" onPress={() => moveDay(1)} />
      </View>

      <Text style={styles.fieldLabel}>Not (isteğe bağlı)</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="ör. BİM, elektrik faturası…"
        placeholderTextColor={C.muted}
        style={styles.textInput}
        selectionColor={C.accent}
        maxLength={60}
      />

      <Pressable onPress={save} style={({ pressed }) => [styles.bigBtn, pressed && { opacity: 0.85 }]}>
        <Text style={styles.bigBtnText}>Kaydet</Text>
      </Pressable>

      {item && (
        <Pressable
          onPress={() =>
            Alert.alert('Silinsin mi?', 'Bu harcama kalıcı olarak silinecek.', [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Sil', style: 'destructive', onPress: () => onDelete(item.id) },
            ])
          }
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
        >
          <Text style={styles.deleteBtnText}>Harcamayı Sil</Text>
        </Pressable>
      )}
    </FullDialog>
  );
}

function IncomeDialog({ periodName, salary, extras, insets, onClose, onSetSalary, onAddExtra, onDeleteExtra }) {
  const [salaryText, setSalaryText] = useState(amountToInput(salary));
  const [extraText, setExtraText] = useState('');
  const [extraNote, setExtraNote] = useState('');

  const salaryChanged = parseAmount(salaryText) !== salary;

  const commitSalary = () => {
    const n = parseAmount(salaryText);
    if (n !== salary) onSetSalary(n);
    Keyboard.dismiss();
  };

  const addExtra = () => {
    const n = parseAmount(extraText);
    if (!n) return Alert.alert('Tutar gir', 'Ek gelir tutarını yaz.');
    onAddExtra(n, extraNote.trim());
    setExtraText('');
    setExtraNote('');
    Keyboard.dismiss();
  };

  const done = () => {
    if (salaryChanged) onSetSalary(parseAmount(salaryText));
    if (parseAmount(extraText)) onAddExtra(parseAmount(extraText), extraNote.trim());
    onClose();
  };

  return (
    <FullDialog title={`Gelir · ${periodName}`} onClose={done} onSave={done} saveLabel="Tamam" insets={insets}>
      <Text style={styles.fieldLabel}>Aylık maaş</Text>
      <AmountField value={salaryText} onChangeText={setSalaryText} onSubmit={commitSalary} />
      <Text style={styles.hint}>
        Her ayın {PAYDAY}'unda otomatik gelir sayılır. Değiştirirsen bu dönemden itibaren geçerli olur, geçmiş aylar
        bozulmaz.
      </Text>

      <View style={styles.divider} />

      <Text style={styles.fieldLabel}>Ek gelir (sadece bu ay)</Text>
      {extras.length > 0 && (
        <View style={[styles.card0, { marginBottom: 14 }]}>
          {extras.map((e, i) => (
            <View key={e.id} style={[styles.item, i > 0 && styles.itemBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{e.note || 'Ek gelir'}</Text>
              </View>
              <Text style={[styles.itemAmount, { color: C.green }]}>+{fmt(e.amount)}</Text>
              <Pressable
                hitSlop={10}
                onPress={() =>
                  Alert.alert('Silinsin mi?', `${fmt(e.amount)} ek gelir silinecek.`, [
                    { text: 'Vazgeç', style: 'cancel' },
                    { text: 'Sil', style: 'destructive', onPress: () => onDeleteExtra(e.id) },
                  ])
                }
                style={{ marginLeft: 14 }}
              >
                <Text style={{ color: C.muted, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <TextInput
        value={extraText}
        onChangeText={setExtraText}
        keyboardType="decimal-pad"
        placeholder="Tutar"
        placeholderTextColor={C.muted}
        style={styles.textInput}
        selectionColor={C.accent}
      />
      <TextInput
        value={extraNote}
        onChangeText={setExtraNote}
        placeholder="Açıklama (ör. prim, mesai)"
        placeholderTextColor={C.muted}
        style={[styles.textInput, { marginTop: 10 }]}
        selectionColor={C.accent}
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={addExtra}
      />
      <Pressable onPress={addExtra} style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}>
        <Text style={styles.outlineBtnText}>＋ Ek Gelir Ekle</Text>
      </Pressable>
    </FullDialog>
  );
}

// ---------- Stiller ----------
const num = { fontVariant: ['tabular-nums'] };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  pressed: { opacity: 0.6 },

  periodRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 8 },
  periodTitle: { color: C.text, fontSize: 20, fontWeight: '700' },
  periodSub: { color: C.muted, fontSize: 13, marginTop: 2 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { color: C.text, fontSize: 22, fontWeight: '600', marginTop: -2 },

  hero: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },
  heroLabel: { color: C.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
  heroValue: { fontSize: 48, fontWeight: '800', marginTop: 4, ...num },
  bar: { height: 8, borderRadius: 4, backgroundColor: C.surface2, marginTop: 14, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barText: { color: C.muted, fontSize: 13, marginTop: 8 },

  statRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 16 },
  stat: { flex: 1, backgroundColor: C.surface, borderRadius: 18, padding: 16 },
  statLabel: { color: C.muted, fontSize: 13, fontWeight: '600' },
  statValue: { fontSize: 22, fontWeight: '700', marginTop: 6, ...num },
  statSub: { color: C.muted, fontSize: 12, marginTop: 4 },

  card: { backgroundColor: C.surface, borderRadius: 18, padding: 16, marginHorizontal: 16, marginTop: 16 },
  card0: { backgroundColor: C.surface, borderRadius: 18, marginHorizontal: 0, overflow: 'hidden' },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  catRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  catIcon: { fontSize: 20, width: 34 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between' },
  catName: { color: C.text, fontSize: 15 },
  catTotal: { color: C.text, fontSize: 15, fontWeight: '600', ...num },
  catBar: { height: 5, borderRadius: 3, backgroundColor: C.surface2, marginTop: 6, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3, backgroundColor: C.red },

  dayHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 8 },
  dayLabel: { color: C.muted, fontSize: 13, fontWeight: '600' },
  dayTotal: { color: C.muted, fontSize: 13, ...num },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  itemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemTitle: { color: C.text, fontSize: 16 },
  itemSub: { color: C.muted, fontSize: 13, marginTop: 2 },
  itemAmount: { color: C.text, fontSize: 16, fontWeight: '600', ...num },

  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: C.text, fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySub: { color: C.muted, fontSize: 14, marginTop: 4 },

  fab: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: C.accent,
    borderRadius: 30,
    paddingHorizontal: 28,
    height: 58,
    justifyContent: 'center',
    elevation: 6,
  },
  fabText: { color: '#0B0C0F', fontSize: 17, fontWeight: '800' },

  dialogBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  dialogTitle: { flex: 1, color: C.text, fontSize: 18, fontWeight: '700', marginLeft: 12 },
  saveBtn: { backgroundColor: C.accent, borderRadius: 20, paddingHorizontal: 18, height: 40, justifyContent: 'center' },
  saveBtnText: { color: '#0B0C0F', fontSize: 15, fontWeight: '800' },

  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
  },
  amountInput: { flex: 1, color: C.text, fontSize: 40, fontWeight: '800', paddingVertical: 14, ...num },
  amountTl: { color: C.muted, fontSize: 32, fontWeight: '700' },

  fieldLabel: { color: C.muted, fontSize: 13, fontWeight: '700', letterSpacing: 0.5, marginTop: 22, marginBottom: 10 },
  hint: { color: C.muted, fontSize: 13, marginTop: 10, lineHeight: 19 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1.5,
    borderColor: C.surface,
  },
  chipOn: { borderColor: C.accent, backgroundColor: '#1D2440' },
  chipIcon: { fontSize: 18, marginRight: 8 },
  chipText: { color: C.muted, fontSize: 15, fontWeight: '600' },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 6,
  },
  dateText: { color: C.text, fontSize: 16, fontWeight: '600' },

  textInput: {
    backgroundColor: C.surface,
    borderRadius: 14,
    color: C.text,
    fontSize: 16,
    paddingHorizontal: 16,
    height: 52,
  },
  bigBtn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  bigBtnText: { color: '#0B0C0F', fontSize: 17, fontWeight: '800' },
  deleteBtn: { height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  deleteBtnText: { color: C.red, fontSize: 16, fontWeight: '600' },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  outlineBtnText: { color: C.text, fontSize: 16, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginTop: 26 },
});
