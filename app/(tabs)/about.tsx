import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function About() {
    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>About This App</Text>
                <Text style={styles.version}>Version 1.0.0</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.text}>
                    This application is designed to help you quickly scan and process QR codes with ease. It features an intuitive interface and reliable scanning capabilities.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Developer</Text>
                <Text style={styles.text}>Created by Anush D'costa</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Acknowledgements</Text>
                <Text style={styles.text}>Built using React Native and Expo.</Text>
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 24,
        backgroundColor: '#f8f9fa',
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 8,
    },
    version: {
        fontSize: 16,
        color: '#6c757d',
    },
    section: {
        marginBottom: 24,
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#495057',
        marginBottom: 12,
    },
    text: {
        fontSize: 16,
        color: '#343a40',
        lineHeight: 24,
    },
});
