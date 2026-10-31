import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import {
  getReceiptEvidencePreviewUrl,
  listReceiptEvidenceUploads,
  refreshReceiptEvidenceStatus,
  resumeReceiptEvidenceUpload,
  reviewReceiptEvidence,
  type ReceiptUploadSession,
} from '../services/receiptEvidence';
import { Colors, Radii, Spacing, Typography } from './design-system/tokens';

interface Props {
  businessId?: string | null;
}

const RETRY_STATES = new Set(['STAGED', 'INTENT_CREATED', 'UPLOADING', 'UPLOAD_RETRY', 'VERIFY_PENDING']);

export function ReceiptEvidenceQueue({ businessId }: Readonly<Props>) {
  const [sessions, setSessions] = useState<ReceiptUploadSession[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewedIds, setPreviewedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const rows = await listReceiptEvidenceUploads(businessId ?? undefined);
    setSessions(rows);
  }, [businessId]);

  useEffect(() => {
    void reload().catch((cause) => setError(String(cause)));
  }, [reload]);

  const runAction = useCallback(async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await reload();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusyId(null);
    }
  }, [reload]);

  return (
    <View style={{ position: 'absolute', top: Spacing.xxl, left: Spacing.lg, right: Spacing.lg, zIndex: 20 }}>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel="Show saved receipt evidence uploads"
        style={{ alignSelf: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: Radii.pill, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm }}
      >
        <Text style={{ ...Typography.caption, color: Colors.ui.white }}>Evidence uploads ({sessions.length}) {expanded ? '−' : '+'}</Text>
      </Pressable>
      {expanded ? (
        <View style={{ marginTop: Spacing.sm, maxHeight: 320, backgroundColor: Colors.ui.surface, borderColor: Colors.ui.border, borderWidth: 1, borderRadius: Radii.lg, padding: Spacing.md }}>
          <ScrollView>
            {sessions.length === 0 ? (
              <Text style={{ ...Typography.caption, color: Colors.ui.textMuted }}>No saved evidence uploads.</Text>
            ) : sessions.slice(0, 10).map((session) => {
              const displayStatus = session.server_status ?? session.status;
              const busy = busyId === session.client_upload_id;
              return (
                <View key={session.client_upload_id} style={{ paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.ui.border }}>
                  <Text numberOfLines={1} style={{ ...Typography.caption, color: Colors.ui.text }}>{session.filename}</Text>
                  <Text style={{ ...Typography.micro, color: Colors.ui.textMuted, marginTop: 2 }}>
                    {displayStatus}{session.review_status ? ` · Review ${session.review_status}` : ''}
                  </Text>
                  {session.last_error ? <Text numberOfLines={2} style={{ ...Typography.micro, color: Colors.status.warningText }}>{session.last_error}</Text> : null}
                  {busy ? <ActivityIndicator color={Colors.brand.primary} size="small" /> : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.xs }}>
                      {RETRY_STATES.has(session.status) ? (
                        <Pressable onPress={() => void runAction(session.client_upload_id, async () => {
                          await resumeReceiptEvidenceUpload(session.client_upload_id);
                        })} accessibilityRole="button">
                          <Text style={{ ...Typography.micro, color: Colors.brand.primary }}>Retry upload</Text>
                        </Pressable>
                      ) : null}
                      {session.server_receipt_id && ['QUARANTINED', 'SCANNING', 'SCAN_FAILED', 'CLEAN', 'ATTACHED'].includes(displayStatus) ? (
                        <Pressable onPress={() => void runAction(session.client_upload_id, async () => {
                          await refreshReceiptEvidenceStatus(session.client_upload_id);
                        })} accessibilityRole="button">
                          <Text style={{ ...Typography.micro, color: Colors.brand.primary }}>Refresh status</Text>
                        </Pressable>
                      ) : null}
                      {session.server_receipt_id && ['CLEAN', 'ATTACHED'].includes(displayStatus) && session.review_status === 'REQUIRED' ? (
                        <>
                          <Pressable onPress={() => void runAction(session.client_upload_id, async () => {
                            const url = await getReceiptEvidencePreviewUrl(session.client_upload_id);
                            await Linking.openURL(url);
                            setPreviewedIds((current) => new Set(current).add(session.client_upload_id));
                          })} accessibilityRole="button">
                            <Text style={{ ...Typography.micro, color: Colors.brand.primary }}>Preview</Text>
                          </Pressable>
                          <Pressable disabled={!previewedIds.has(session.client_upload_id)} onPress={() => void runAction(session.client_upload_id, async () => {
                            await reviewReceiptEvidence(session.client_upload_id, 'ACCEPT');
                          })} accessibilityRole="button">
                            <Text style={{ ...Typography.micro, color: previewedIds.has(session.client_upload_id) ? Colors.status.successText : Colors.ui.textDim }}>Accept</Text>
                          </Pressable>
                          <Pressable disabled={!previewedIds.has(session.client_upload_id)} onPress={() => void runAction(session.client_upload_id, async () => {
                            await reviewReceiptEvidence(session.client_upload_id, 'REJECT');
                          })} accessibilityRole="button">
                            <Text style={{ ...Typography.micro, color: previewedIds.has(session.client_upload_id) ? Colors.status.dangerText : Colors.ui.textDim }}>Reject</Text>
                          </Pressable>
                        </>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
          {error ? <Text accessibilityRole="alert" style={{ ...Typography.micro, color: Colors.status.warningText, marginTop: Spacing.sm }}>{error}</Text> : null}
          <Pressable onPress={() => void reload().catch((cause) => setError(String(cause)))} accessibilityRole="button" style={{ paddingTop: Spacing.sm }}>
            <Text style={{ ...Typography.micro, color: Colors.brand.primary }}>Reload saved uploads</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
