/**
 * ConfirmModal - 交易二次确认弹窗
 * 显示详细信息、风险提示、确认/取消按钮
 */
import React from "react";
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { ManusColors } from "@/constants/manus-ui";

type ConfirmType = "swap" | "transfer";

interface SwapDetails {
  fromAmount: string;
  fromSymbol: string;
  toAmount: string;
  toSymbol: string;
  rate: string;
  slippage: string;
  gasFee?: string;
  route?: string;
}

interface TransferDetails {
  amount: string;
  symbol: string;
  toAddress: string;
  gasFee?: string;
  network?: string;
}

interface ConfirmModalProps {
  visible: boolean;
  type: ConfirmType;
  swapDetails?: SwapDetails;
  transferDetails?: TransferDetails;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmModal({ 
  visible, 
  type, 
  swapDetails, 
  transferDetails, 
  onConfirm, 
  onCancel,
  loading 
}: ConfirmModalProps) {
  const isSwap = type === "swap";
  const title = isSwap ? "确认兑换" : "确认转账";
  const icon = isSwap ? "swap-horizontal-bold" : "send";
  const gradientColors = isSwap ? ["#EEF2FF", "#E0E7FF"] : ["#ECFEFF", "#CFFAFE"];
  const accentColor = isSwap ? "#6366F1" : "#06B6D4";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        
        <View style={styles.modalContainer}>
          <LinearGradient colors={gradientColors as [string, string]} style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.iconWrap, { backgroundColor: `${accentColor}20` }]}>
                <MaterialCommunityIcons name={icon} size={28} color={accentColor} />
              </View>
              <Text style={styles.title}>{title}</Text>
              <Pressable style={styles.closeBtn} onPress={onCancel}>
                <MaterialCommunityIcons name="close" size={24} color={ManusColors.muted} />
              </Pressable>
            </View>

            {/* Content */}
            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {isSwap && swapDetails && (
                <>
                  {/* Swap Visual */}
                  <View style={styles.swapVisual}>
                    <View style={styles.swapSide}>
                      <Text style={styles.swapLabel}>支出</Text>
                      <Text style={styles.swapAmount}>{swapDetails.fromAmount}</Text>
                      <Text style={styles.swapSymbol}>{swapDetails.fromSymbol}</Text>
                    </View>
                    <View style={styles.swapArrow}>
                      <MaterialCommunityIcons name="arrow-right" size={24} color={accentColor} />
                    </View>
                    <View style={styles.swapSide}>
                      <Text style={styles.swapLabel}>获得</Text>
                      <Text style={[styles.swapAmount, { color: "#10B981" }]}>{swapDetails.toAmount}</Text>
                      <Text style={styles.swapSymbol}>{swapDetails.toSymbol}</Text>
                    </View>
                  </View>

                  {/* Details */}
                  <View style={styles.detailsCard}>
                    <DetailRow label="兑换比率" value={swapDetails.rate} />
                    <DetailRow label="滑点容差" value={swapDetails.slippage} />
                    {swapDetails.gasFee && <DetailRow label="预估 Gas" value={swapDetails.gasFee} highlight />}
                    {swapDetails.route && <DetailRow label="兑换路由" value={swapDetails.route} />}
                  </View>
                </>
              )}

              {!isSwap && transferDetails && (
                <>
                  {/* Transfer Visual */}
                  <View style={styles.transferVisual}>
                    <Text style={styles.transferAmount}>{transferDetails.amount}</Text>
                    <Text style={styles.transferSymbol}>{transferDetails.symbol}</Text>
                    <View style={styles.transferArrow}>
                      <MaterialCommunityIcons name="arrow-down" size={20} color={accentColor} />
                    </View>
                    <Text style={styles.transferAddress}>{transferDetails.toAddress}</Text>
                  </View>

                  {/* Details */}
                  <View style={styles.detailsCard}>
                    {transferDetails.network && <DetailRow label="网络" value={transferDetails.network} />}
                    {transferDetails.gasFee && <DetailRow label="预估 Gas" value={transferDetails.gasFee} highlight />}
                  </View>
                </>
              )}

              {/* Warning */}
              <View style={styles.warningCard}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#F59E0B" />
                <Text style={styles.warningText}>
                  交易一旦确认将无法撤销，请仔细核对以上信息。
                </Text>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable 
                style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]} 
                onPress={onCancel}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable 
                style={({ pressed }) => [
                  styles.confirmBtn, 
                  { backgroundColor: accentColor },
                  pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                  loading && { opacity: 0.6 }
                ]} 
                onPress={onConfirm}
                disabled={loading}
              >
                <Text style={styles.confirmBtnText}>{loading ? "处理中..." : "确认执行"}</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: "#F59E0B", fontWeight: "700" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    maxHeight: "85%",
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: ManusColors.text,
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  scrollContent: {
    maxHeight: 400,
  },
  // Swap Visual
  swapVisual: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  swapSide: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  swapLabel: {
    fontSize: 12,
    color: ManusColors.muted,
  },
  swapAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: ManusColors.text,
  },
  swapSymbol: {
    fontSize: 14,
    fontWeight: "600",
    color: ManusColors.textSecondary,
  },
  swapArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(99,102,241,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
  },
  // Transfer Visual
  transferVisual: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    gap: 4,
  },
  transferAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: ManusColors.text,
  },
  transferSymbol: {
    fontSize: 16,
    fontWeight: "600",
    color: ManusColors.textSecondary,
  },
  transferArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(6,182,212,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  transferAddress: {
    fontSize: 13,
    color: ManusColors.muted,
    fontFamily: "monospace",
  },
  // Details Card
  detailsCard: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 14,
    color: ManusColors.muted,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: ManusColors.text,
  },
  // Warning
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245,158,11,0.1)",
    borderRadius: 12,
    padding: 14,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
  },
  // Actions
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: ManusColors.textSecondary,
  },
  confirmBtn: {
    flex: 1.5,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
