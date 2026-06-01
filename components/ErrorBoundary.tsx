import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, DevSettings, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
  }

  private handleRestart = () => {
    try {
      DevSettings.reload();
    } catch (e) {
      console.warn('Native DevSettings reload failed, fallback log:', e);
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              An unexpected error occurred in BioLens.
            </Text>
            <ScrollView style={styles.errorScroll}>
              <Text style={styles.errorText}>
                {this.state.error?.toString()}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.button}
              onPress={this.handleRestart}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Restart Application</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.darkText,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorScroll: {
    maxHeight: 150,
    backgroundColor: '#FFF2F0',
    borderColor: COLORS.coral,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    width: '100%',
    marginBottom: 24,
  },
  errorText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: COLORS.coral,
  },
  button: {
    backgroundColor: COLORS.primaryGreen,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    shadowColor: COLORS.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default ErrorBoundary;
