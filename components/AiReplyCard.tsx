import React from 'react';
import { View, StyleSheet } from 'react-native';

interface AiReplyCardProps {
  children: React.ReactNode;
}

export function AiReplyCard({ children }: AiReplyCardProps) {
  return <View style={styles.card}>{children}</View>;
}

export default AiReplyCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
});
