import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  LayoutAnimation,
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
import {
  useFonts,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist';
import { GeistMono_500Medium, GeistMono_600SemiBold } from '@expo-google-fonts/geist-mono';
import { ShoppingCartIcon } from 'phosphor-react-native/src/icons/ShoppingCart';
import { LightningIcon } from 'phosphor-react-native/src/icons/Lightning';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { GasPumpIcon } from 'phosphor-react-native/src/icons/GasPump';
import { ForkKnifeIcon } from 'phosphor-react-native/src/icons/ForkKnife';
import { PillIcon } from 'phosphor-react-native/src/icons/Pill';
import { TShirtIcon } from 'phosphor-react-native/src/icons/TShirt';
import { CreditCardIcon } from 'phosphor-react-native/src/icons/CreditCard';
import { ConfettiIcon } from 'phosphor-react-native/src/icons/Confetti';
import { PackageIcon } from 'phosphor-react-native/src/icons/Package';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { ReceiptIcon } from 'phosphor-react-native/src/icons/Receipt';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { ArrowCounterClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowCounterClockwise';
import { WalletIcon } from 'phosphor-react-native/src/icons/Wallet';

// ---------- Sabitler ----------
const STORAGE_KEY = 'gelir-gider:v1';
const PAYDAY = 10; // maaş günü: dönem her ayın 10'unda başlar

// Zinc nötrler + tek vurgu (zümrüt). Gider için sadece veri rengi olarak soluk gül.
const C = {
  bg: '#0C0C0E',
  surface: '#151518',
  surface2: '#1D1D21',
  border: '#27272C',
  text: '#F4F4F5',
  muted: '#8E8E96',
  faint: '#5A5A62',
  accent: '#4CC38A',
  accentInk: '#06140D',
  accentSoft: '#13261D',
  red: '#E5736F',
};

const F = {
  r: 'Geist_400Regular',
  m: 'Geist_500Medium',
  sb: 'Geist_600SemiBold',
  b: 'Geist_700Bold',
  mono: 'GeistMono_500Medium',
  monoSb: 'GeistMono_600SemiBold',
};

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

const CATS = [
  { id: 'market', label: 'Market', Icon: ShoppingCartIcon },
  { id: 'fatura', label: 'Fatura', Icon: LightningIcon },
  { id: 'kira', label: 'Kira', Icon: HouseIcon },
  { id: 'ulasim', label: 'Ulaşım', Icon: GasPumpIcon },
  { id: 'yemek', label: 'Yemek', Icon: ForkKnifeIcon },
  { id: 'saglik', label: 'Sağlık', Icon: PillIcon },
  { id: 'giyim', label: 'Giyim', Icon: TShirtIcon },
  { id: 'borc', label: 'Borç/Kredi', Icon: CreditCardIcon },
  { id: 'eglence', label: 'Eğlence', Icon: ConfettiIcon },
  { id: 'diger', label: 'Diğer', Icon: PackageIcon },
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
const startOfToday = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};

function salaryFor(salaries, key) {
  let best = null;
  for (const s of salaries) if (s.from <= key && (!best || s.from > best.from)) best = s;
  return best ? best.amount : 0;
}

function dayLabel(iso) {
  const d = fromISO(iso);
  const today = startOfToday();
  const yest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (sameDay(d, today)) return 'Bugün';
  if (sameDay(d, yest)) return 'Dün';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${DAYS[d.getDay()]}`;
}

const animateNext = () =>
  LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));

// ---------- Uygulama ----------
export default function App() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
  });

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {fontsLoaded ? <Main /> : <View style={styles.root} />}
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

    return { salary, extras, extraTotal, spent, income, left: income - spent, cats, groups, count: expenses.length };
  }, [data, key]);

  // ---- veri işlemleri ----
  const update = (fn) => {
    animateNext();
    setData(fn);
  };
  const saveExpense = (exp) =>
    update((d) => {
      const exists = d.expenses.some((e) => e.id === exp.id);
      return {
        ...d,
        expenses: exists ? d.expenses.map((e) => (e.id === exp.id ? exp : e)) : [...d.expenses, exp],
      };
    });
  const deleteExpense = (id) => update((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }));
  const setSalary = (amount) =>
    update((d) => ({
      ...d,
      salaries: [...d.salaries.filter((s) => s.from !== key), { from: key, amount }],
    }));
  const addExtra = (amount, note) =>
    update((d) => ({
      ...d,
      extras: { ...d.extras, [key]: [...(d.extras[key] || []), { id: uid(), amount, note }] },
    }));
  const deleteExtra = (id) =>
    update((d) => ({
      ...d,
      extras: { ...d.extras, [key]: (d.extras[key] || []).filter((e) => e.id !== id) },
    }));

  if (!loaded) return <Skeleton insets={insets} />;

  const ratio = view.income > 0 ? Math.min(view.spent / view.income, 1) : view.spent > 0 ? 1 : 0;
  const ps = periodStart(period);
  const pe = periodEnd(period);
  const nextPayday = new Date(pe.getFullYear(), pe.getMonth(), pe.getDate() + 1);
  const daysLeft = Math.max(1, Math.round((nextPayday - startOfToday()) / 86400000));

  let heroNote;
  if (view.income === 0) heroNote = 'Maaşını girince kalan parayı burada görürsün';
  else if (isCurrent && view.left > 0)
    heroNote = `Maaşa ${daysLeft} gün · günde ${fmt(Math.floor(view.left / daysLeft))} harcayabilirsin`;
  else if (view.left < 0) heroNote = `Gelirini ${fmt(-view.left)} aştın`;
  else heroNote = `Gelirin %${Math.round(ratio * 100)}'i harcandı`;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Dönem başlığı: sola yaslı, oklar sağda */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {MONTHS[period.m]} {period.y}
            </Text>
            <Text style={styles.headerSub}>
              {ps.getDate()} {MONTHS_SHORT[ps.getMonth()]} – {pe.getDate()} {MONTHS_SHORT[pe.getMonth()]}
            </Text>
          </View>
          {!isCurrent && (
            <Tap style={styles.todayBtn} onPress={() => setPeriod(currentPeriod)}>
              <ArrowCounterClockwiseIcon size={15} color={C.accent} weight="bold" />
              <Text style={styles.todayText}>Bugün</Text>
            </Tap>
          )}
          <RoundBtn onPress={() => setPeriod((p) => shiftPeriod(p, -1))}>
            <CaretLeftIcon size={20} color={C.text} weight="bold" />
          </RoundBtn>
          <RoundBtn onPress={() => setPeriod((p) => shiftPeriod(p, 1))} style={{ marginLeft: 8 }}>
            <CaretRightIcon size={20} color={C.text} weight="bold" />
          </RoundBtn>
        </View>

        {/* Kalan */}
        <View style={styles.hero}>
          <Text style={styles.label}>Kalan</Text>
          <Text
            style={[styles.heroValue, view.left < 0 && { color: C.red }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {fmt(view.left)}
          </Text>
          <ProgressBar ratio={ratio} danger={ratio >= 0.9} />
          <Text style={styles.heroNote}>{heroNote}</Text>
        </View>

        {/* Gelir / Gider: asimetrik ikili */}
        <View style={styles.statRow}>
          <Tap style={[styles.stat, { flex: 1.25 }]} onPress={() => setIncomeOpen(true)}>
            <View style={styles.statHead}>
              <Text style={styles.label}>Gelir</Text>
              <View style={styles.editDot}>
                <PencilSimpleIcon size={13} color={C.accent} weight="bold" />
              </View>
            </View>
            <Text style={[styles.statValue, { color: C.accent }]} numberOfLines={1} adjustsFontSizeToFit>
              {fmt(view.income)}
            </Text>
            <Text style={styles.statSub} numberOfLines={1}>
              {view.salary ? `Maaş ${fmt(view.salary)}` : 'Maaşı girmek için dokun'}
            </Text>
            {view.extraTotal > 0 && (
              <Text style={styles.statSub} numberOfLines={1}>
                Ek {fmt(view.extraTotal)}
              </Text>
            )}
          </Tap>
          <View style={[styles.stat, { flex: 1 }]}>
            <Text style={styles.label}>Gider</Text>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
              {fmt(view.spent)}
            </Text>
            <Text style={styles.statSub}>{view.count} harcama</Text>
          </View>
        </View>

        {/* Kategori dağılımı: kart yok, sadece boşluk ve çizgiler */}
        {view.cats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nereye gitti</Text>
            {view.cats.map((c, i) => (
              <FadeIn key={key + c.id} index={i}>
                <View style={styles.catRow}>
                  <c.Icon size={20} color={C.muted} weight="duotone" duotoneColor={C.text} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <View style={styles.catTop}>
                      <Text style={styles.catName}>{c.label}</Text>
                      <Text style={styles.catTotal}>{fmt(c.total)}</Text>
                    </View>
                    <View style={styles.catBar}>
                      <View style={[styles.catBarFill, { width: `${(c.total / view.spent) * 100}%` }]} />
                    </View>
                  </View>
                </View>
              </FadeIn>
            ))}
          </View>
        )}

        {/* Harcamalar */}
        {view.groups.length === 0 ? (
          <FadeIn key={key + 'empty'} index={0}>
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <ReceiptIcon size={28} color={C.muted} weight="duotone" />
              </View>
              <Text style={styles.emptyText}>Bu dönemde harcama yok</Text>
              <Text style={styles.emptySub}>
                {view.salary
                  ? 'Harcadıkça sağ alttaki butondan ekle. Kalan para kendiliğinden güncellenir.'
                  : 'Önce maaşını gir, sonra harcadıkça ekle.'}
              </Text>
              {!view.salary && (
                <Tap style={styles.emptyCta} onPress={() => setIncomeOpen(true)}>
                  <WalletIcon size={18} color={C.accentInk} weight="bold" />
                  <Text style={styles.emptyCtaText}>Maaşını gir</Text>
                </Tap>
              )}
            </View>
          </FadeIn>
        ) : (
          <View style={{ marginTop: 8 }}>
            {view.groups.map((g, gi) => (
              <FadeIn key={key + g.date} index={gi + view.cats.length}>
                <View style={styles.dayHead}>
                  <Text style={styles.dayLabel}>{dayLabel(g.date)}</Text>
                  <Text style={styles.dayTotal}>{fmt(g.total)}</Text>
                </View>
                <View style={styles.group}>
                  {g.items.map((e, i) => {
                    const c = catById(e.cat);
                    return (
                      <Tap
                        key={e.id}
                        scaleTo={0.985}
                        onPress={() => setExpenseDialog({ item: e })}
                        style={[styles.item, i > 0 && styles.itemBorder]}
                      >
                        <View style={styles.itemIcon}>
                          <c.Icon size={20} color={C.text} weight="duotone" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle} numberOfLines={1}>
                            {e.note || c.label}
                          </Text>
                          {e.note ? <Text style={styles.itemSub}>{c.label}</Text> : null}
                        </View>
                        <Text style={styles.itemAmount}>-{fmt(e.amount)}</Text>
                      </Tap>
                    );
                  })}
                </View>
              </FadeIn>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Ekle butonu: sağ alt, başparmak bölgesi */}
      <Tap
        outerStyle={[styles.fabWrap, { bottom: insets.bottom + 20 }]}
        style={styles.fab}
        scaleTo={0.95}
        onPress={() => setExpenseDialog({})}
      >
        <PlusIcon size={20} color={C.accentInk} weight="bold" />
        <Text style={styles.fabText}>Gider ekle</Text>
      </Tap>

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

// ---------- Hareket bileşenleri ----------

// Basınca hafifçe içeri gömülen dokunma alanı (native driver, render tetiklemez)
function Tap({ onPress, style, outerStyle, scaleTo = 0.97, hitSlop, children }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v, bounciness) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness }).start();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(scaleTo, 0)}
      onPressOut={() => to(1, 6)}
      hitSlop={hitSlop}
      style={outerStyle}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function RoundBtn({ onPress, style, children }) {
  return (
    <Tap onPress={onPress} hitSlop={6} scaleTo={0.9} style={[styles.roundBtn, style]}>
      {children}
    </Tap>
  );
}

// Listelerin sırayla belirmesi
function FadeIn({ index = 0, children }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: 380,
      delay: Math.min(index, 10) * 40,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, []);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  return <Animated.View style={{ opacity: v, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// scaleX ile dolan çubuk (width animasyonu yok)
function ProgressBar({ ratio, danger }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.spring(v, { toValue: ratio, useNativeDriver: true, stiffness: 100, damping: 20 });
    anim.start();
    return () => anim.stop();
  }, [ratio]);
  return (
    <View style={styles.bar}>
      <Animated.View
        style={[
          styles.barFill,
          { backgroundColor: danger ? C.red : C.accent, transform: [{ scaleX: v }] },
        ]}
      />
    </View>
  );
}

function Skeleton({ insets }) {
  const v = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.9, duration: 650, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const B = ({ w, h, r = 10, mt = 0, flex }) => (
    <Animated.View
      style={{ width: w, height: h, borderRadius: r, marginTop: mt, flex, backgroundColor: C.surface2, opacity: v }}
    />
  );
  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingHorizontal: 20 }]}>
      <B w={150} h={26} />
      <B w={90} h={14} mt={8} />
      <B w={70} h={14} mt={36} />
      <B w={240} h={52} mt={10} />
      <B w="100%" h={8} mt={18} r={4} />
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 28 }}>
        <B h={104} r={22} flex={1.25} />
        <B h={104} r={22} flex={1} />
      </View>
      <B w="100%" h={180} r={22} mt={28} />
    </View>
  );
}

// ---------- Pencereler ----------

// Android tarzı tam ekran pencere: Kaydet üstte, klavye kapatamaz
function FullDialog({ title, onClose, onSave, saveLabel = 'Kaydet', insets, children }) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.dialogBar}>
          <RoundBtn onPress={onClose}>
            <XIcon size={20} color={C.text} weight="bold" />
          </RoundBtn>
          <Text style={styles.dialogTitle} numberOfLines={1}>
            {title}
          </Text>
          {onSave && (
            <Tap onPress={onSave} hitSlop={8} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>{saveLabel}</Text>
            </Tap>
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

function Field({ label, helper, error, children }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.errorText}>{error}</Text> : helper ? <Text style={styles.hint}>{helper}</Text> : null}
    </View>
  );
}

function AmountField({ value, onChangeText, autoFocus, onSubmit, invalid }) {
  return (
    <View style={[styles.amountBox, invalid && { borderColor: C.red }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={C.faint}
        style={styles.amountInput}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        selectionColor={C.accent}
        cursorColor={C.accent}
      />
      <Text style={styles.amountTl}>₺</Text>
    </View>
  );
}

function ExpenseDialog({ item, period, insets, onClose, onSave, onDelete }) {
  const ps = periodStart(period);
  const pe = periodEnd(period);
  const today = startOfToday();
  const initialDate = item ? fromISO(item.date) : today >= ps && today <= pe ? today : ps;

  const [amount, setAmount] = useState(item ? amountToInput(item.amount) : '');
  const [cat, setCat] = useState(item ? item.cat : null);
  const [note, setNote] = useState(item ? item.note : '');
  const [date, setDate] = useState(initialDate);
  const [errors, setErrors] = useState({});

  const moveDay = (n) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
    if (d >= ps && d <= pe) setDate(d);
  };

  const save = () => {
    const n = parseAmount(amount);
    const e = {};
    if (!n) e.amount = 'Harcama tutarını yaz.';
    if (!cat) e.cat = 'Ne için harcadığını seç.';
    if (e.amount || e.cat) {
      animateNext();
      return setErrors(e);
    }
    onSave({
      id: item ? item.id : uid(),
      created: item ? item.created : Date.now(),
      amount: n,
      cat,
      note: note.trim(),
      date: toISO(date),
    });
  };

  const atStart = sameDay(date, ps);
  const atEnd = sameDay(date, pe);

  return (
    <FullDialog title={item ? 'Harcamayı düzenle' : 'Yeni harcama'} onClose={onClose} onSave={save} insets={insets}>
      <Text style={styles.fieldLabel}>Tutar</Text>
      <AmountField
        value={amount}
        onChangeText={(t) => {
          setAmount(t);
          if (errors.amount) setErrors((x) => ({ ...x, amount: null }));
        }}
        autoFocus={!item}
        onSubmit={Keyboard.dismiss}
        invalid={!!errors.amount}
      />
      {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}

      <Field label="Ne için" error={errors.cat}>
        <View style={styles.catGrid}>
          {CATS.map((c) => {
            const on = cat === c.id;
            return (
              <Tap
                key={c.id}
                scaleTo={0.94}
                onPress={() => {
                  setCat(c.id);
                  if (errors.cat) setErrors((x) => ({ ...x, cat: null }));
                  Keyboard.dismiss();
                }}
                style={[styles.chip, on && styles.chipOn]}
              >
                <c.Icon size={18} color={on ? C.accent : C.muted} weight={on ? 'fill' : 'regular'} />
                <Text style={[styles.chipText, on && { color: C.text }]}>{c.label}</Text>
              </Tap>
            );
          })}
        </View>
      </Field>

      <Field label="Tarih">
        <View style={styles.dateRow}>
          <RoundBtn onPress={() => moveDay(-1)} style={atStart && { opacity: 0.35 }}>
            <CaretLeftIcon size={18} color={C.text} weight="bold" />
          </RoundBtn>
          <Text style={styles.dateText}>{dayLabel(toISO(date))}</Text>
          <RoundBtn onPress={() => moveDay(1)} style={atEnd && { opacity: 0.35 }}>
            <CaretRightIcon size={18} color={C.text} weight="bold" />
          </RoundBtn>
        </View>
      </Field>

      <Field label="Not" helper="İsteğe bağlı. Listede kategori yerine bu görünür.">
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="BİM, elektrik faturası…"
          placeholderTextColor={C.faint}
          style={styles.textInput}
          selectionColor={C.accent}
          cursorColor={C.accent}
          maxLength={60}
        />
      </Field>

      <Tap onPress={save} style={styles.bigBtn}>
        <Text style={styles.bigBtnText}>Kaydet</Text>
      </Tap>

      {item && (
        <Tap
          onPress={() =>
            Alert.alert('Silinsin mi?', 'Bu harcama kalıcı olarak silinecek.', [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Sil', style: 'destructive', onPress: () => onDelete(item.id) },
            ])
          }
          style={styles.deleteBtn}
        >
          <TrashIcon size={18} color={C.red} weight="bold" />
          <Text style={styles.deleteBtnText}>Harcamayı sil</Text>
        </Tap>
      )}
    </FullDialog>
  );
}

function IncomeDialog({ periodName, salary, extras, insets, onClose, onSetSalary, onAddExtra, onDeleteExtra }) {
  const [salaryText, setSalaryText] = useState(amountToInput(salary));
  const [extraText, setExtraText] = useState('');
  const [extraNote, setExtraNote] = useState('');
  const [extraError, setExtraError] = useState(null);

  const commitSalary = () => {
    const n = parseAmount(salaryText);
    if (n !== salary) onSetSalary(n);
    Keyboard.dismiss();
  };

  const addExtra = () => {
    const n = parseAmount(extraText);
    if (!n) return setExtraError('Ek gelir tutarını yaz.');
    onAddExtra(n, extraNote.trim());
    setExtraText('');
    setExtraNote('');
    setExtraError(null);
    Keyboard.dismiss();
  };

  const done = () => {
    if (parseAmount(salaryText) !== salary) onSetSalary(parseAmount(salaryText));
    if (parseAmount(extraText)) onAddExtra(parseAmount(extraText), extraNote.trim());
    onClose();
  };

  return (
    <FullDialog title={`Gelir · ${periodName}`} onClose={done} onSave={done} saveLabel="Tamam" insets={insets}>
      <Text style={styles.fieldLabel}>Aylık maaş</Text>
      <AmountField value={salaryText} onChangeText={setSalaryText} onSubmit={commitSalary} />
      <Text style={styles.hint}>
        Her ayın {PAYDAY}'unda kendiliğinden gelir sayılır. Değiştirirsen bu dönemden itibaren geçerli olur, geçmiş
        aylar etkilenmez.
      </Text>

      <View style={styles.divider} />

      <Text style={styles.fieldLabel}>Ek gelir · sadece bu dönem</Text>
      {extras.length > 0 && (
        <View style={[styles.group, { marginHorizontal: 0, marginBottom: 14 }]}>
          {extras.map((e, i) => (
            <View key={e.id} style={[styles.item, i > 0 && styles.itemBorder]}>
              <Text style={[styles.itemTitle, { flex: 1 }]} numberOfLines={1}>
                {e.note || 'Ek gelir'}
              </Text>
              <Text style={[styles.itemAmount, { color: C.accent }]}>+{fmt(e.amount)}</Text>
              <Pressable
                hitSlop={12}
                style={{ marginLeft: 16 }}
                onPress={() =>
                  Alert.alert('Silinsin mi?', `${fmt(e.amount)} ek gelir silinecek.`, [
                    { text: 'Vazgeç', style: 'cancel' },
                    { text: 'Sil', style: 'destructive', onPress: () => onDeleteExtra(e.id) },
                  ])
                }
              >
                <XIcon size={18} color={C.muted} weight="bold" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <TextInput
        value={extraText}
        onChangeText={(t) => {
          setExtraText(t);
          if (extraError) setExtraError(null);
        }}
        keyboardType="decimal-pad"
        placeholder="Tutar"
        placeholderTextColor={C.faint}
        style={[styles.textInput, extraError && { borderColor: C.red }]}
        selectionColor={C.accent}
        cursorColor={C.accent}
      />
      {extraError && <Text style={styles.errorText}>{extraError}</Text>}
      <TextInput
        value={extraNote}
        onChangeText={setExtraNote}
        placeholder="Açıklama: prim, mesai…"
        placeholderTextColor={C.faint}
        style={[styles.textInput, { marginTop: 10 }]}
        selectionColor={C.accent}
        cursorColor={C.accent}
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={addExtra}
      />
      <Tap onPress={addExtra} style={styles.outlineBtn}>
        <PlusIcon size={18} color={C.text} weight="bold" />
        <Text style={styles.outlineBtnText}>Ek gelir ekle</Text>
      </Tap>
    </FullDialog>
  );
}

// ---------- Stiller ----------
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  headerTitle: { color: C.text, fontSize: 24, fontFamily: F.b, letterSpacing: -0.6 },
  headerSub: { color: C.muted, fontSize: 13, fontFamily: F.m, marginTop: 2 },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 21,
    backgroundColor: C.accentSoft,
    marginRight: 8,
  },
  todayText: { color: C.accent, fontSize: 14, fontFamily: F.sb },

  label: { color: C.muted, fontSize: 13, fontFamily: F.m },
  hero: { paddingHorizontal: 20, paddingTop: 20 },
  heroValue: { color: C.text, fontSize: 46, fontFamily: F.b, letterSpacing: -1.6, marginTop: 2 },
  bar: { height: 6, borderRadius: 3, backgroundColor: C.surface2, marginTop: 16, overflow: 'hidden' },
  barFill: { height: '100%', width: '100%', borderRadius: 3, transformOrigin: 'left' },
  heroNote: { color: C.muted, fontSize: 14, fontFamily: F.r, marginTop: 10, lineHeight: 20 },

  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 24 },
  stat: {
    backgroundColor: C.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 112,
  },
  statHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { color: C.text, fontSize: 21, fontFamily: F.monoSb, letterSpacing: -0.6, marginTop: 8 },
  statSub: { color: C.muted, fontSize: 12, fontFamily: F.r, marginTop: 4 },

  section: { paddingHorizontal: 20, marginTop: 32 },
  sectionTitle: { color: C.text, fontSize: 17, fontFamily: F.sb, letterSpacing: -0.3, marginBottom: 4 },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  catName: { color: C.text, fontSize: 15, fontFamily: F.m },
  catTotal: { color: C.text, fontSize: 14, fontFamily: F.mono },
  catBar: { height: 4, borderRadius: 2, backgroundColor: C.surface2, marginTop: 8, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 2, backgroundColor: C.muted },

  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 8,
  },
  dayLabel: { color: C.muted, fontSize: 13, fontFamily: F.sb },
  dayTotal: { color: C.faint, fontSize: 13, fontFamily: F.mono },
  group: {
    backgroundColor: C.surface,
    borderRadius: 22,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
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
  itemTitle: { color: C.text, fontSize: 16, fontFamily: F.m },
  itemSub: { color: C.muted, fontSize: 13, fontFamily: F.r, marginTop: 2 },
  itemAmount: { color: C.text, fontSize: 15, fontFamily: F.mono },

  empty: { paddingHorizontal: 20, paddingTop: 40, alignItems: 'flex-start' },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: C.text, fontSize: 17, fontFamily: F.sb, marginTop: 16 },
  emptySub: { color: C.muted, fontSize: 14, fontFamily: F.r, marginTop: 6, lineHeight: 21, maxWidth: 300 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 16,
    height: 48,
    paddingHorizontal: 18,
    marginTop: 18,
  },
  emptyCtaText: { color: C.accentInk, fontSize: 15, fontFamily: F.b },

  fabWrap: { position: 'absolute', right: 20 },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 20,
    height: 58,
    paddingHorizontal: 22,
    elevation: 8,
    shadowColor: C.accent,
  },
  fabText: { color: C.accentInk, fontSize: 16, fontFamily: F.b },

  dialogBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  dialogTitle: { flex: 1, color: C.text, fontSize: 18, fontFamily: F.sb, letterSpacing: -0.3, marginLeft: 14 },
  saveBtn: { backgroundColor: C.accent, borderRadius: 14, paddingHorizontal: 18, height: 42, justifyContent: 'center' },
  saveBtnText: { color: C.accentInk, fontSize: 15, fontFamily: F.b },

  fieldLabel: { color: C.muted, fontSize: 13, fontFamily: F.m, marginBottom: 8 },
  hint: { color: C.muted, fontSize: 13, fontFamily: F.r, marginTop: 8, lineHeight: 19 },
  errorText: { color: C.red, fontSize: 13, fontFamily: F.m, marginTop: 8 },

  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  amountInput: {
    flex: 1,
    color: C.text,
    fontSize: 40,
    fontFamily: F.monoSb,
    letterSpacing: -1,
    paddingVertical: 14,
  },
  amountTl: { color: C.faint, fontSize: 30, fontFamily: F.sb },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  chipText: { color: C.muted, fontSize: 15, fontFamily: F.m },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 6,
  },
  dateText: { color: C.text, fontSize: 16, fontFamily: F.sb },

  textInput: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 16,
    fontFamily: F.r,
    paddingHorizontal: 16,
    height: 52,
  },
  bigBtn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  bigBtnText: { color: C.accentInk, fontSize: 16, fontFamily: F.b },
  deleteBtn: {
    flexDirection: 'row',
    gap: 8,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  deleteBtnText: { color: C.red, fontSize: 15, fontFamily: F.sb },
  outlineBtn: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  outlineBtnText: { color: C.text, fontSize: 15, fontFamily: F.sb },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 28 },
});
