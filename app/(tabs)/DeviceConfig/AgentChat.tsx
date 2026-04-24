import { FontAwesome } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { default as React, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { btService } from '../../../services/BluetoothService';

const processedRequests = new Set<string>();
const FormattedText = ({ text, style }: { text: string, style?: any }) => {
    if (!text) return null;

    // Split by ** to find bold sections
    const parts = text.split(/(\*\*.*?\*\*)/g);

    return (
        <Text style={style}>
            {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    const innerText = part.slice(2, -2);
                    const prevPart = index > 0 ? parts[index - 1] : null;
                    const isFirstPart = index === 0 || (index === 1 && prevPart === "");
                    const followsNewline = prevPart && (prevPart.endsWith('\n') || (prevPart.trim().length === 0 && prevPart.includes('\n')));
                    const isHeader = isFirstPart || followsNewline;

                    return (
                        <Text key={index} style={isHeader ? { fontSize: 18, fontWeight: '800', lineHeight: 30, color: '#FFF', textAlign: 'left' } : { fontWeight: 'bold' }}>
                            {innerText}
                        </Text>
                    );
                }
                return <Text key={index}>{part}</Text>;
            })}
        </Text>
    );
};

let globalIsServerRunning = false;
let globalServerCallback: ((req: any) => void) | null = null;

export default function AgentChat() {
    const [message, setMessage] = useState('');
    const [chatLog, setChatLog] = useState<{
        role: string,
        text: string,
        tableData?: any[],
        showButtons?: boolean,
        ButtonOptions?: { label: string, action?: () => void }[],
        graphData?: { completed: number, notCompleted: number, missed: number },
        isExpert?: boolean
    }[]>([
        { role: 'agent', text: 'Hello! How can I help you today?' }
    ]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const scrollViewRef = useRef<ScrollView>(null);
    const [isListening, setIsListening] = useState(false);
    const [agentResponse, setAgentResponse] = useState('');
    const [sessionId, setSessionId] = useState('');
    const url = Linking.useLinkingURL();
    const [useNextTrigger, setUseNextTrigger] = useState(false);
    const [lockMode, setLockMode] = useState(false);
    const [currentTrigger, setCurrentTrigger] = useState("http://100.104.205.24:5678/webhook/thought_dump");
    const [nextTrigger, setNextTrigger] = useState("http://100.104.205.24:5678/webhook/thought_dump");
    const [settingsData, setSettingsData] = useState<any[]>([]);
    const [isParentMode, setIsParentMode] = useState(false);
    const [pendingRoute, setPendingRoute] = useState<{ pathname: string, params?: any } | null>(null);
    const startServerRef = useRef<() => void>(() => { });

    const BarGraph = ({ data }: { data: { completed: number, notCompleted: number, missed: number } }) => {
        const total = Math.max(data.completed + data.notCompleted + data.missed, 1);
        const maxHeight = 100;

        const renderBar = (value: number, color: string, label: string) => {
            const barHeight = (value / total) * maxHeight;
            return (
                <View style={styles.barWrapper}>
                    <Text style={styles.barValue}>{value}</Text>
                    <View style={[styles.bar, { height: Math.max(barHeight, 5), backgroundColor: color }]} />
                    <Text style={styles.barLabel}>{label}</Text>
                </View>
            );
        };

        return (
            <View style={styles.graphContainer}>
                {renderBar(data.completed, '#4CAF50', 'Comp')}
                {renderBar(data.notCompleted, '#FFEB3B', 'Pending')}
                {renderBar(data.missed, '#F44336', 'Missed')}
            </View>
        );
    };

    useEffect(() => {
        if (pendingRoute) {
            // Delay navigation so the HTTP bridge can fully respond to n8n
            // before React begins the screen transition (prevents 'service refused')
            const t = setTimeout(() => {
                router.push(pendingRoute as any);
                setPendingRoute(null);
            }, 500);
            return () => clearTimeout(t);
        }
    }, [pendingRoute]);

    const resetChatState = React.useCallback(() => {
        setAgentResponse("");
        setSessionId("");
        setUseNextTrigger(false);
        setLockMode(false);
        setNextTrigger("http://100.104.205.24:5678/webhook/thought_dump");
        setChatLog([]);
        Speech.stop();
        let processed = false;
        const listener = (data: any) => {
            if (processed) return; // Ignore duplicate Pi responses
            processed = true;
            // Self-remove first — belt-and-suspenders with the blur cleanup
            btService.onSettingsUpdateListeners = btService.onSettingsUpdateListeners.filter(l => l !== listener);

            console.log("AgentChat received Settings Data: ", data);
            setSettingsData(data);
            console.log("Current Mode: ", data[0].current_mode);
            if (data[0].current_mode === "Parent") {
                setChatLog([]);
                console.log("Parent Mode activated");
                setChatLog(prev => [...prev, { role: 'agent', text: "I am in Parent Mode. What would you like to do?", ButtonOptions: [{ label: "Continue on the Cogni-Jarvis Chat" }, { label: "Continue in the Parent mode chat" }] }]);
                setCurrentTrigger("http://100.104.205.24:5678/webhook/switch_mode");
            } else {
                setChatLog([{ role: 'agent', text: 'Hello! How can I help you today?' }]);
                setCurrentTrigger("http://100.104.205.24:5678/webhook/thought_dump");
            }
        };

        btService.onSettingsUpdateListeners.push(listener);
        console.log("AgentChat requesting settings from Pi...");
        btService.sendMessage("GET_SETTING");

        // Cleanup on blur — prevents listener stacking when focus is regained
        return () => {
            btService.onSettingsUpdateListeners = btService.onSettingsUpdateListeners.filter(l => l !== listener);
        };
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            resetChatState();
        }, [resetChatState])
    );

    useEffect(() => {
        globalServerCallback = (request: any) => {
            const currentServer = require('react-native-http-bridge');
            console.log("Incoming Local Server Request:", request);

            if (request.type === 'GET' && request.url === '/health') {
                currentServer.respond(request.requestId, 200, "application/json", '{"status": "ok"}');
                console.log("Responded to health check");
                return;
            }

            if (request.type === 'POST' && request.url === '/n8n_trigger') {
                try {
                    const rawBody = request.postData || request.body || '{}';
                    if (processedRequests.has(request.requestId)) {
                        console.log("Skipping duplicate requestId:", request.requestId);
                        currentServer.respond(request.requestId, 200, "application/json", '{"status": "success"}');
                        return;
                    }
                    processedRequests.add(request.requestId);
                    setTimeout(() => processedRequests.delete(request.requestId), 15000);

                    console.log("Raw Post Data:", rawBody);

                    const data = JSON.parse(rawBody);
                    console.log("Parsed JSON:", data);

                    let parsedButtonOptions: { label: string }[] | undefined = undefined;

                    if (data.option && typeof data.option === 'string') {
                        parsedButtonOptions = data.option.split(',').map((s: string) => ({ label: s.trim() })).filter((btn: any) => btn.label.length > 0);
                    } if (data.trigger) {
                        setUseNextTrigger(true);
                    } if (data.trigger === 'schedule') {
                        const msg = data.msg;
                        // Use a timeout to ensure state update happens on main JS thread
                        setTimeout(() => {
                            setChatLog(prev => [...prev, { role: 'agent', text: msg, ButtonOptions: parsedButtonOptions }]);
                            Speech.stop();
                            Speech.speak(msg, { language: 'en-US', pitch: 1.0, rate: 1.2 });
                        }, 10);
                    } else if (data.trigger === 'jsonList' && Array.isArray(data.data)) {
                        setTimeout(() => {
                            setChatLog(prev => [...prev, {
                                role: 'agent',
                                text: "Here is the schedule data you requested:",
                                tableData: data.data,
                                showButtons: !parsedButtonOptions,
                                ButtonOptions: parsedButtonOptions,
                            }]);
                            setNextTrigger(data.nextTrigger);
                            Speech.speak("Here is the schedule data you requested. Would you like to continue?", { language: 'en-US', pitch: 1.0, rate: 1.2 });
                        }, 10);
                    } else if (data.trigger === 'confirmation') {
                        const msg = data.msg;
                        setTimeout(() => {
                            setChatLog(prev => [
                                ...prev,
                                { role: 'agent', text: msg },
                                { role: 'agent', text: "Would you like to continue?", showButtons: !parsedButtonOptions, ButtonOptions: parsedButtonOptions }
                            ]);
                            setNextTrigger(data.nextTrigger);
                            Speech.stop();
                            Speech.speak(msg, { language: 'en-US', pitch: 1.0, rate: 1.2 });
                        }, 10);
                    } else if (data.trigger === 'confirmation_check') {
                        const msg = data.msg;
                        setTimeout(() => {
                            setChatLog(prev => [...prev, { role: 'agent', text: msg, showButtons: !parsedButtonOptions, ButtonOptions: parsedButtonOptions }]);
                            Speech.stop();
                            Speech.speak(msg, { language: 'en-US', pitch: 1.0, rate: 1.2 });
                            setNextTrigger(data.nextTrigger);
                        }, 10);

                    } else if (data.trigger === 'feedback') {
                        const msg = data.msg;
                        setTimeout(() => {
                            setChatLog(prev => [...prev, { role: 'agent', text: msg, ButtonOptions: parsedButtonOptions }]);
                            Speech.stop();
                            Speech.speak(msg, { language: 'en-US', pitch: 1.0, rate: 1.2 });
                            setNextTrigger(data.nextTrigger);
                        }, 10);

                    } else if (data.trigger === "conversation") {
                        const msg = data.msg;
                        setTimeout(() => {
                            setChatLog(prev => [...prev, { role: 'agent', text: msg, ButtonOptions: parsedButtonOptions }]);
                            Speech.stop();
                            Speech.speak(msg, { language: 'en-US', pitch: 1.0, rate: 1.2 });
                        }, 10);
                    } else if (data.trigger === 'end') {
                        const msg = data.msg;
                        setTimeout(() => {
                            setChatLog(prev => [...prev, { role: 'agent', text: msg, ButtonOptions: parsedButtonOptions }]);
                            Speech.stop();
                            Speech.speak(msg, { language: 'en-US', pitch: 1.0, rate: 1.2 });
                        }, 10);
                    } else if (data.trigger === 'switchmode') {
                        const msg = data.msg;
                        setTimeout(() => {
                            setChatLog(prev => [...prev, { role: 'agent', text: msg, ButtonOptions: parsedButtonOptions }]);
                            setCurrentTrigger(data.nextTrigger);
                            Speech.stop();
                            Speech.speak(msg, { language: 'en-US', pitch: 1.0, rate: 1.2 });
                            if (data?.parent_mode === "1") {
                                setIsParentMode(true)
                            } else {
                                setIsParentMode(false)
                            }
                        }, 10);
                    } else if (data.trigger === 'ParentConvo') {
                        const msg = data.msg;
                        setTimeout(() => {
                            setChatLog(prev => [...prev, { role: 'agent', text: msg, ButtonOptions: parsedButtonOptions }]);
                            Speech.stop();
                            Speech.speak(msg, { language: 'en-US', pitch: 1.0, rate: 1.2 });
                        }, 10);
                    } else if (data.trigger === 'offtimemodify') {
                        setTimeout(() => {
                            setPendingRoute({
                                pathname: '/(tabs)/DeviceConfig/OfftimeModify',
                                params: { msg: data.msg || '' },
                            });
                        }, 10);
                    } else if (data.trigger === 'graph') {
                        const msg = data.msg;
                        const graphDetails = data.graphdets || "";
                        // Format: "completed:10,notCompleted:5,missed:2"
                        const parts = graphDetails.split(",");
                        console.log("parts are", parts)
                        const completed = parseInt(parts[0]?.split(":")[1] || "0");
                        const notCompleted = parseInt(parts[1]?.split(":")[1] || "0");
                        const missed = parseInt(parts[2]?.split(":")[1] || "0");
                        console.log("list is", completed, notCompleted, missed)
                        setTimeout(() => {
                            setChatLog(prev => [...prev, {
                                role: 'agent',
                                text: msg,
                                graphData: { completed, notCompleted, missed }
                            }]);
                            Speech.speak(msg, { language: 'en-US', pitch: 1.0, rate: 1.2 });
                        }, 10);
                    } else if (data.trigger === 'tasks') {
                        const msg = data.msg;
                        setTimeout(() => {
                            setChatLog(prev => [...prev, {
                                role: 'agent',
                                text: msg,
                                tableData: data.tasks,
                                ButtonOptions: parsedButtonOptions
                            }]);
                            Speech.stop();
                            Speech.speak(msg, { language: 'en-US', pitch: 1.0, rate: 1.2 });
                        }, 10);
                    } else if (data.trigger === 'parent') {
                        const msg = data.msg;
                        setTimeout(() => {
                            setChatLog(prev => [...prev, { role: 'agent', text: msg, ButtonOptions: parsedButtonOptions, isExpert: true }]);
                            Speech.stop();
                            Speech.speak(msg, { language: 'en-US', pitch: 1.0, rate: 1.2 });
                        }, 10);
                        setLockMode(true);
                    } else {
                        console.warn("Received POST but no matching 'trigger' field found in:", data);
                    }

                    currentServer.respond(request.requestId, 200, "application/json", '{"status": "success"}');
                } catch (e) {
                    console.error("Local Server JSON Parse Error:", e);
                    currentServer.respond(request.requestId, 400, "application/json", '{"error": "Invalid JSON"}');
                }
            } else {
                // Handled unsupported endpoints
                currentServer.respond(request.requestId, 404, "application/json", '{"error": "Not Found"}');
            }
        };

        const startServer = async () => {
            try {
                // @ts-ignore
                const currentServer = require('react-native-http-bridge');
                console.log("Starting local HTTP server...");
                try {
                    await currentServer.stop();
                    console.log("Server stopped.");
                } catch (e) { }

                // Ensure only one listener is registered at the native level
                currentServer.start(8080, 'n8n_server', (request: any) => {
                    if (globalServerCallback) {
                        globalServerCallback(request);
                    } else {
                        currentServer.respond(request.requestId, 503, "application/json", '{"error": "Service Unavailable"}');
                    }
                });
                globalIsServerRunning = true;
            } catch (err) {
                console.error("Failed to start local HTTP server:", err);
                globalIsServerRunning = false;
            }
        };

        startServerRef.current = startServer;

        // Only start if not already running to avoid listener accumulation
        if (!globalIsServerRunning) {
            startServer();
        }

        // Heartbeat: verify the server is actually responding via /health
        const heartbeat = setInterval(async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const response = await fetch('http://localhost:8080/health', {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    // console.log("already running (Heartbeat: Healthy)"); // Quiet down the healthy logs
                    globalIsServerRunning = true;
                } else {
                    throw new Error("Server response not ok");
                }
            } catch (err) {
                console.log("Heartbeat failed or timed out, attempt restart...");
                globalIsServerRunning = false;
                startServer();
            }
        }, 15000); // 15s check is enough

        return () => clearInterval(heartbeat);
    }, []);

    useSpeechRecognitionEvent("result", (event) => {
        setMessage(event.results[0].transcript);
    });

    useSpeechRecognitionEvent("start", () => setIsListening(true));
    useSpeechRecognitionEvent("end", () => setIsListening(false));

    const handleVoiceInput = async () => {
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!result.granted) return;

        if (isListening) {
            ExpoSpeechRecognitionModule.stop();
        } else {
            ExpoSpeechRecognitionModule.start({ lang: "en-US" });
        }
    };

    const N8N_WEBHOOK_URL = 'http://100.104.205.24:5678/webhook/thought_dump';

    const handleSendMessage = async (customMessage?: any) => {
        const msgText = typeof customMessage === 'string' ? customMessage : message;
        if (!msgText.trim()) return;
        let userMsg = msgText;

        setChatLog(prev => [...prev, { role: 'user', text: userMsg }]);
        if (typeof customMessage !== 'string') {
            setMessage('');
        }
        setLoading(true);
        console.log("agentResponse", agentResponse);
        console.log("sessionId", sessionId);
        let json_input;
        const currentSettings = settingsData && settingsData.length > 0 ? settingsData[0] : settingsData;

        if (agentResponse.includes("[REQUEST]")) {
            userMsg = msgText + " [RESPONSE]";
            json_input = { "content": userMsg, "sessionId": sessionId, "phone": true, "settings": currentSettings, "parent_mode": isParentMode, "lock_mode": lockMode };
        } else {
            userMsg = msgText;
            json_input = { "content": userMsg, "phone": true, "settings": currentSettings, "parent_mode": isParentMode, "lock_mode": lockMode };
        }

        try {
            const targetUrl = useNextTrigger ? nextTrigger : currentTrigger;
            console.log("targetUrl", targetUrl);
            if (useNextTrigger) {
                setUseNextTrigger(false); // Reset so it only applies to the very next message
            }

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(json_input),
            });

            const text = await response.text();
            console.log(text);

            let agentResponse = "";
            let parsedButtonOptions: { label: string, action: () => void }[] | undefined = undefined;

            try {
                const data = JSON.parse(text);
                agentResponse = data.output || text;

                let buttonOptionsStr = "";
                if (data.buttonoptions) {
                    buttonOptionsStr = data.buttonoptions;
                } else if (typeof agentResponse === 'string' && agentResponse.toLowerCase().includes("buttonoptions:")) {
                    const parts = agentResponse.split(/buttonoptions:/i);
                    agentResponse = parts[0].trim();
                    buttonOptionsStr = parts[1].trim();
                }

                if (buttonOptionsStr) {
                    parsedButtonOptions = buttonOptionsStr.split(',').map(s => {
                        const label = s.trim();
                        return { label, action: () => handleSendMessage(label) };
                    }).filter(btn => btn.label.length > 0);
                }

                setAgentResponse(agentResponse);
                if (data.sessionId) {
                    setSessionId(data.sessionId);
                } else {
                    setSessionId("");
                }
            } catch (e) {
                agentResponse = text;
                if (typeof agentResponse === 'string' && agentResponse.toLowerCase().includes("buttonoptions:")) {
                    const parts = agentResponse.split(/buttonoptions:/i);
                    agentResponse = parts[0].trim();
                    const buttonOptionsStr = parts[1].trim();
                    if (buttonOptionsStr) {
                        parsedButtonOptions = buttonOptionsStr.split(',').map(s => {
                            const label = s.trim();
                            return { label, action: () => handleSendMessage(label) };
                        }).filter(btn => btn.label.length > 0);
                    }
                }
                setAgentResponse(agentResponse);
            }

            if (agentResponse.includes("[REQUEST]")) {
                agentResponse = agentResponse.split("[REQUEST]")[0];
            }

            if (agentResponse.trim() || (parsedButtonOptions && parsedButtonOptions.length > 0)) {
                setChatLog(prev => [...prev, {
                    role: 'agent',
                    text: agentResponse.trim(),
                    ButtonOptions: parsedButtonOptions,
                    isExpert: lockMode
                }]);
                if (agentResponse.trim()) {
                    Speech.speak(agentResponse.trim(), {
                        language: 'en-US',
                        pitch: 1.0,
                        rate: 1.2,
                    });
                }
            }

        } catch (error) {
            console.error("Network Error:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: '#121212' }}
            // If the keyboard still covers the input, increase this value (e.g., to 90 or 100)
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <TouchableWithoutFeedback style={{ flex: 1, backgroundColor: '#121212' }} onPress={Keyboard.dismiss}>
                {/* 1. Added this wrapper View as the SINGLE child of TouchableWithoutFeedback */}
                <View style={styles.container}>

                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()}>
                            <FontAwesome name="chevron-left" size={20} color="#ff7b00" />
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.headerTitle}>AI Agent</Text>
                            <TouchableOpacity
                                onPress={() => startServerRef.current()}
                                style={{ marginLeft: 10 }}
                            >
                                <FontAwesome name="refresh" size={16} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={() => { resetChatState(); btService.sendMessage("GET_SETTING"); }}>
                            <FontAwesome name="plus" size={20} color="#888" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.chatContainer}
                        ref={scrollViewRef} // Attach the ref correctly
                        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                    >
                        {chatLog.map((chat, i) => (
                            <View key={i} style={[
                                styles.bubble,
                                chat.role === 'user' ? styles.userBubble : styles.agentBubble,
                                chat.isExpert ? styles.expertBubble : null,
                                chat.tableData || chat.graphData ? { width: '100%', maxWidth: '100%' } : (chat.ButtonOptions && chat.ButtonOptions.length > 0 ? { maxWidth: '90%' } : null)
                            ]}>
                                <FormattedText style={styles.chatText} text={chat.text} />
                                {chat.graphData && <BarGraph data={chat.graphData} />}
                                {chat.tableData && (
                                    <View style={styles.tableContainer}>
                                        <View style={[styles.tableRow, styles.tableHeader]}>
                                            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 2 }]}>Task</Text>
                                            <Text style={[styles.tableCell, styles.tableHeaderText]}>Start</Text>
                                            <Text style={[styles.tableCell, styles.tableHeaderText]}>End</Text>
                                            <Text style={[styles.tableCell, styles.tableHeaderText]}>Status</Text>
                                        </View>
                                        {chat.tableData.map((row, j) => (
                                            <View key={j} style={[styles.tableRow, j % 2 === 1 ? styles.tableRowAlt : null]}>
                                                <Text style={[styles.tableCell, { flex: 2, marginRight: 5 }]}>{row.task_name || "Unknown"}</Text>
                                                <Text style={styles.tableCell}>{row.start_time ? row.start_time.split(' ')[1].substring(0, 5) : "--"}</Text>
                                                <Text style={styles.tableCell}>{row.end_time ? row.end_time.split(' ')[1].substring(0, 5) : "--"}</Text>
                                                <Text style={[styles.tableCell, { color: row.status === "Missed Task" ? "red" : row.status === "Not Completed" ? "green" : "yellow" }]}>{row.status}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                                {chat.ButtonOptions && chat.ButtonOptions.length > 0 ? (
                                    <View style={[styles.buttonContainer, { flexDirection: 'column' }]}>
                                        {chat.ButtonOptions.map((option, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                style={[styles.actionButton, { marginBottom: 10, paddingVertical: 10, flex: 0 }]}
                                                onPress={() => {
                                                    setChatLog(prev => prev.map((c, index) => index === i ? { ...c, ButtonOptions: undefined } : c));
                                                    if (option.action) {
                                                        option.action();
                                                    } else {
                                                        handleSendMessage(option.label);
                                                    }
                                                }}
                                            >
                                                <Text style={[styles.actionButtonText, { textAlign: 'center' }]}>{option.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : chat.showButtons && (
                                    <View style={styles.buttonContainer}>
                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => {
                                                setChatLog(prev => prev.map((c, index) => index === i ? { ...c, showButtons: false } : c));
                                                handleSendMessage("Yes");
                                            }}
                                        >
                                            <Text style={styles.actionButtonText}>Yes</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.actionButtonNo]}
                                            onPress={() => {
                                                setChatLog(prev => prev.map((c, index) => index === i ? { ...c, showButtons: false } : c));
                                                handleSendMessage("No");
                                            }}
                                        >
                                            <Text style={styles.actionButtonText}>No</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        ))}
                        {loading && <ActivityIndicator color="#ff7b00" style={{ margin: 10 }} />}
                    </ScrollView>

                    <View style={styles.inputArea}>
                        <TextInput
                            style={styles.input}
                            value={message}
                            onChangeText={setMessage}
                            placeholder="Type your message..."
                            placeholderTextColor="#666"
                            // 3. For Android, this ensures the keyboard doesn't push the header off-screen
                            multiline={false}
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, isListening && { backgroundColor: 'red' }]}
                            onPress={message.trim() ? handleSendMessage : handleVoiceInput}
                        >
                            <FontAwesome
                                name={message.trim() ? "send" : (isListening ? "stop" : "microphone")}
                                size={18}
                                color="white"
                            />
                        </TouchableOpacity>
                    </View>

                </View>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
        paddingTop: 50,
        backgroundColor: '#1e1e1e'
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold'
    },
    chatContainer: {
        flex: 1,
        padding: 15
    },
    bubble: {
        padding: 12,
        borderRadius: 15,
        marginBottom: 10,
        maxWidth: '80%'
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#ff7b00'
    },
    agentBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#333'
    },
    expertBubble: {
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: '#ff7b00',
        borderLeftWidth: 4,
        padding: 16,
    },
    chatText: {
        color: '#fff',
        lineHeight: 22,
        textAlign: 'justify'
    },
    inputArea: {
        flexDirection: 'row',
        padding: 15,
        backgroundColor: '#1e1e1e',
        alignItems: 'center'
    },
    input: {
        flex: 1,
        backgroundColor: '#222',
        color: '#fff',
        borderRadius: 20,
        paddingHorizontal: 15,
        height: 40,
        marginRight: 10
    },
    sendBtn: {
        backgroundColor: '#ff7b00',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center'
    },
    buttonContainer: {
        flexDirection: 'row',
        marginTop: 10,
        gap: 10
    },
    actionButton: {
        backgroundColor: '#44cc44',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        flex: 1,
        alignItems: 'center'
    },
    actionButtonNo: {
        backgroundColor: '#cc4444'
    },
    actionButtonText: {
        color: 'white',
        fontWeight: 'bold'
    },
    tableContainer: {
        marginTop: 10,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#222'
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        paddingVertical: 8,
        paddingHorizontal: 5
    },
    tableRowAlt: {
        backgroundColor: '#2a2a2a'
    },
    tableHeader: {
        backgroundColor: '#111',
        borderBottomWidth: 2,
        borderBottomColor: '#444'
    },
    tableCell: {
        flex: 1,
        color: '#ccc',
        fontSize: 12
    },
    tableHeaderText: {
        fontWeight: 'bold',
        color: '#fff'
    },
    graphContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        height: 140,
        marginTop: 15,
        backgroundColor: '#222',
        borderRadius: 10,
        padding: 10,
    },
    barWrapper: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: '100%',
        width: 60,
    },
    bar: {
        width: 30,
        borderRadius: 5,
        marginTop: 5,
    },
    barValue: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    barLabel: {
        color: '#aaa',
        fontSize: 10,
        marginTop: 5,
    }
});