import {
  REPORT_CHAT_DISCLAIMER,
  type ReportChatReply,
  type ReportChatTurn,
} from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { Card } from '@/components/ui/card'
import { useAppState } from '@/state/app-state'
import { colors, radius, sp, type } from '@/theme/tokens'

/** Mirrors the API contract: message ≤ 500 chars, history ≤ 12 turns. */
const MAX_MESSAGE_LENGTH = 500
const MAX_HISTORY_TURNS = 12

const SUGGESTED_QUESTIONS = [
  'What should I eat more of?',
  'Any foods to cut back on?',
  'Plan a simple day of meals for me',
]

/**
 * Nutritionist chat for one report. Replies are grounded server-side in the
 * user's confirmed metrics only, and every reply carries the reference-only
 * disclaimer — the intro card repeats it so it is visible before the first
 * reply arrives.
 */
export function ReportNutritionChat({
  reportId,
  hasConfirmedMetrics,
}: {
  reportId: string
  hasConfirmedMetrics: boolean
}) {
  const { sendReportChatMessage } = useAppState()
  const [turns, setTurns] = useState<ReportChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (rawMessage: string) => {
    const message = rawMessage.trim().slice(0, MAX_MESSAGE_LENGTH)
    if (!message || sending) return
    const history = turns.slice(-MAX_HISTORY_TURNS)
    setTurns((previous) => [...previous, { role: 'user', text: message }])
    setDraft('')
    setSending(true)
    setError(null)
    try {
      const reply: ReportChatReply = await sendReportChatMessage(reportId, {
        message,
        history,
      })
      setTurns((previous) => [
        ...previous,
        { role: 'assistant', text: reply.message },
      ])
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The nutritionist could not reply. Try again.'
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <View style={styles.heading}>
        <View style={styles.flex}>
          <Text style={type.h2}>Ask the nutritionist</Text>
          <Text style={styles.muted}>
            Dietary ideas from an AI nutritionist, based only on your
            confirmed values and dietary preference.
          </Text>
        </View>
        <Ionicons name="nutrition" size={20} color={colors.primaryDark} />
      </View>

      <View style={styles.disclaimer}>
        <Ionicons
          name="information-circle-outline"
          size={18}
          color={colors.primaryDark}
        />
        <Text style={styles.disclaimerText}>{REPORT_CHAT_DISCLAIMER}</Text>
      </View>

      {hasConfirmedMetrics ? (
        <>
          {turns.length === 0 ? (
            <View style={styles.suggestions}>
              {SUGGESTED_QUESTIONS.map((question) => (
                <Pressable
                  key={question}
                  style={styles.suggestionChip}
                  onPress={() => void send(question)}
                  disabled={sending}
                  accessibilityRole="button"
                  accessibilityLabel={`Ask: ${question}`}
                >
                  <Text style={styles.suggestionText}>{question}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.messages}>
              {turns.map((turn, index) => (
                <View
                  key={`${turn.role}-${index}`}
                  style={[
                    styles.bubble,
                    turn.role === 'user'
                      ? styles.userBubble
                      : styles.assistantBubble,
                  ]}
                >
                  <Text
                    style={
                      turn.role === 'user'
                        ? styles.userBubbleText
                        : styles.assistantBubbleText
                    }
                  >
                    {turn.text}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {sending ? (
            <View style={styles.pending}>
              <ActivityIndicator color={colors.primaryDark} />
              <Text style={styles.muted}>The nutritionist is thinking…</Text>
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask about food and this report…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              maxLength={MAX_MESSAGE_LENGTH}
              editable={!sending}
              multiline
              accessibilityLabel="Message the nutritionist"
              onSubmitEditing={() => void send(draft)}
            />
            <Pressable
              style={[
                styles.sendButton,
                (sending || !draft.trim()) && styles.disabled,
              ]}
              onPress={() => void send(draft)}
              disabled={sending || !draft.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send message to the nutritionist"
            >
              <Ionicons name="arrow-up" size={18} color={colors.textOnColor} />
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={styles.muted}>
          Confirm at least one metric to chat about this report.
        </Text>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(3),
    marginBottom: sp(3),
  },
  muted: { ...type.small, color: colors.textMuted, marginTop: sp(1) },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(2),
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: sp(3),
    marginBottom: sp(3),
  },
  disclaimerText: { ...type.small, flex: 1, color: colors.text },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(1.5) },
  suggestionChip: {
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingHorizontal: sp(3),
    paddingVertical: sp(1.5),
  },
  suggestionText: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  messages: { gap: sp(2) },
  bubble: {
    maxWidth: '88%',
    borderRadius: radius.md,
    padding: sp(3),
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.text },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft },
  userBubbleText: { ...type.small, color: colors.textOnColor },
  assistantBubbleText: { ...type.small, color: colors.text },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(2),
    marginTop: sp(2),
  },
  error: { ...type.small, color: colors.danger, marginTop: sp(2), fontWeight: '800' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: sp(2),
    marginTop: sp(3),
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: sp(3),
    paddingVertical: sp(2),
    backgroundColor: colors.surface,
    ...type.small,
    color: colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
})
