import type { CoachChatTurn } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Mascot } from '@/components/mascot'
import { useAppState } from '@/state/app-state'
import { colors, radius, sp, type } from '@/theme/tokens'

interface ChatMessage {
  id: number
  role: 'coach' | 'user'
  text: string
}

const STARTERS = ['Why is my energy dipping?', 'What should I eat today?', 'How do my report results look?']
const RESHAPE_STARTER = 'Reshape today’s plan around how I feel'
/** Only the most recent turns travel back — matches the contract cap. */
const HISTORY_LIMIT = 10

export default function CoachChat() {
  const insets = useSafeAreaInsets()
  const { mode } = useLocalSearchParams<{ mode?: string }>()
  const moreMode = mode === 'more'
  const { coach, energy, regeneratePlan, sendCoachMessage } = useAppState()
  const scrollRef = useRef<ScrollView>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    moreMode
      ? []
      : [{ id: 1, role: 'coach', text: coach?.message ?? "Hey, I’m Akeso. Tell me what your day feels like, or ask me anything about it." }]
  )
  const openerRequested = useRef(false)

  const historyForServer = (current: ChatMessage[]): CoachChatTurn[] =>
    current
      .filter((message) => message.text.trim().length > 0)
      .slice(-HISTORY_LIMIT)
      .map((message) => ({ role: message.role, text: message.text }))

  // "Tell Akeso more" opens with the coach asking ONE follow-up question.
  useEffect(() => {
    if (!moreMode || openerRequested.current || !energy) return
    openerRequested.current = true
    let cancelled = false
    setSending(true)
    sendCoachMessage({ message: '', history: [], intent: 'opener' })
      .then((reply) => {
        if (cancelled) return
        setMessages((value) => [...value, { id: Date.now(), role: 'coach', text: reply.message }])
      })
      .catch(() => {
        if (cancelled) return
        setMessages((value) => [
          ...value,
          {
            id: Date.now(),
            role: 'coach',
            text: 'Tell me anything that shapes your day — mood, food, stress, symptoms — and I’ll factor it in.',
          },
        ])
      })
      .finally(() => {
        if (!cancelled) setSending(false)
      })
    return () => {
      cancelled = true
    }
  }, [moreMode, energy, sendCoachMessage])

  const send = async (suggestion?: string) => {
    const text = (suggestion ?? draft).trim()
    if (!text || sending) return
    const outgoing: ChatMessage = { id: Date.now(), role: 'user', text }
    const priorHistory = historyForServer(messages)
    setMessages((value) => [...value, outgoing])
    setDraft('')
    setSending(true)
    setError(null)
    if (!energy) {
      setMessages((value) => [
        ...value,
        {
          id: Date.now() + 1,
          role: 'coach',
          text: 'I need today’s 20-second check-in before I can personalise that. Complete it first, then come back and we can shape your day together.',
        },
      ])
      setSending(false)
      return
    }
    try {
      // The dedicated reshape starter regenerates the plan; every other
      // message is a pure conversation turn that never rewrites the plan.
      const reply =
        text === RESHAPE_STARTER
          ? await regeneratePlan(text)
          : await sendCoachMessage({
              message: text,
              history: priorHistory,
              intent: moreMode ? 'more' : 'chat',
            })
      setMessages((value) => [...value, { id: Date.now() + 1, role: 'coach', text: reply.message }])
    } catch {
      setError('Akeso could not reply just now. Please try again.')
    } finally {
      setSending(false)
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.screen, { paddingTop: insets.top + sp(2), paddingBottom: insets.bottom + sp(2) }]}>
      <View style={styles.header}>
        <View style={styles.coachIdentity}>
          <View style={styles.mascotAvatar}><Mascot state="steady" size={58} /></View>
          <View>
            <View style={styles.onlineRow}><View style={styles.onlineDot} /><Text style={styles.online}>YOUR ENERGY COACH</Text></View>
            <Text style={styles.title}>{moreMode ? 'Tell Akeso more' : 'Talk to Akeso'}</Text>
          </View>
        </View>
        <Pressable accessibilityLabel="Close coach" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })} ref={scrollRef} showsVerticalScrollIndicator={false}>
        <View style={styles.contextCard}>
          <Ionicons name="sparkles" size={18} color={colors.text} />
          <Text style={styles.contextText}>
            {energy
              ? 'Akeso can see your check-in, plan, nutrition, and confirmed report results — ask about any of it.'
              : 'Complete today’s check-in to unlock personalised coaching.'}
          </Text>
        </View>

        {messages.map((message) => (
          <View key={message.id} style={[styles.messageRow, message.role === 'user' && styles.userMessageRow]}>
            {message.role === 'coach' ? <View style={styles.tinyMascot}><Mascot state="steady" size={42} /></View> : null}
            <View style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.coachBubble]}>
              <Text style={[styles.messageText, message.role === 'user' && styles.userMessageText]}>{message.text}</Text>
            </View>
          </View>
        ))}

        {!moreMode && messages.length === 1 ? (
          <View style={styles.starters}>
            {[...STARTERS, RESHAPE_STARTER].map((starter) => (
              <Pressable key={starter} onPress={() => send(starter)} style={({ pressed }) => [styles.starter, pressed && styles.pressed]}>
                <Text style={styles.starterText}>{starter}</Text><Ionicons name="arrow-forward" size={16} color={colors.text} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {sending ? <View style={styles.thinking}><ActivityIndicator color={colors.text} size="small" /><Text style={styles.thinkingText}>Akeso is thinking with your day…</Text></View> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput accessibilityLabel="Message Akeso" editable={!sending} multiline onChangeText={setDraft} onSubmitEditing={() => send()} placeholder={moreMode ? 'Mood, food, stress, symptoms…' : 'Ask about your energy, food, or results…'} placeholderTextColor={colors.textMuted} returnKeyType="send" style={styles.input} value={draft} />
        <Pressable accessibilityLabel="Send message" accessibilityRole="button" disabled={!draft.trim() || sending} onPress={() => send()} style={({ pressed }) => [styles.send, (!draft.trim() || sending) && styles.sendDisabled, pressed && styles.pressed]}>
          <Ionicons name="arrow-up" size={22} color={colors.lime} />
        </Pressable>
      </View>
      <Text style={styles.disclaimer}>Akeso offers general wellbeing guidance, not medical advice.</Text>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: sp(4) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: sp(2), borderBottomColor: colors.border, borderBottomWidth: 1.5 },
  coachIdentity: { flexDirection: 'row', alignItems: 'center', gap: sp(2.5) }, mascotAvatar: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime, borderColor: colors.text, borderRadius: 18, borderWidth: 1.5, overflow: 'hidden' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primaryDark }, online: { ...type.label, color: colors.primaryDark, fontSize: 9 }, title: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderColor: colors.text, borderRadius: 15, borderWidth: 1.5 }, pressed: { transform: [{ translateY: 2 }] },
  messages: { paddingVertical: sp(4), paddingBottom: sp(7) }, contextCard: { flexDirection: 'row', alignItems: 'center', gap: sp(2), alignSelf: 'center', maxWidth: 340, paddingHorizontal: sp(3), paddingVertical: sp(2.5), marginBottom: sp(5), backgroundColor: colors.yellow, borderColor: colors.text, borderRadius: radius.md, borderWidth: 1.5 }, contextText: { flex: 1, color: colors.text, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: sp(2), marginBottom: sp(3), maxWidth: '88%' }, userMessageRow: { alignSelf: 'flex-end', justifyContent: 'flex-end' }, tinyMascot: { width: 38, height: 38, borderColor: colors.text, borderRadius: 13, borderWidth: 1.5, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bubble: { paddingHorizontal: sp(3.5), paddingVertical: sp(3), borderColor: colors.text, borderWidth: 1.5 }, coachBubble: { flex: 1, backgroundColor: colors.surface, borderRadius: 18, borderBottomLeftRadius: 5 }, userBubble: { backgroundColor: colors.text, borderRadius: 18, borderBottomRightRadius: 5 }, messageText: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' }, userMessageText: { color: colors.surface },
  starters: { gap: sp(2), marginTop: sp(2), marginLeft: 46 }, starter: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp(2), paddingHorizontal: sp(3), backgroundColor: colors.primarySoft, borderColor: colors.text, borderRadius: radius.md, borderWidth: 1.5 }, starterText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '800' },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: sp(2), marginLeft: 46, marginVertical: sp(2) }, thinkingText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' }, error: { color: colors.danger, fontSize: 12, fontWeight: '700', marginLeft: 46 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: sp(2), padding: sp(2), backgroundColor: colors.surface, borderColor: colors.text, borderRadius: 22, borderWidth: 1.5, shadowColor: colors.text, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 } }, input: { flex: 1, minHeight: 44, maxHeight: 110, paddingHorizontal: sp(2), paddingVertical: sp(3), color: colors.text, fontSize: 14 }, send: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.text, borderRadius: 15 }, sendDisabled: { opacity: 0.38 }, disclaimer: { color: colors.textMuted, fontSize: 9, textAlign: 'center', marginTop: sp(2) },
})
