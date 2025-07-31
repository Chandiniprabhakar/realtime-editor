import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import Client from '../components/Client';
import Editor from '../components/Editor';
import { initSocket } from '../socket';
import {
    useLocation,
    useNavigate,
    Navigate,
    useParams,
} from 'react-router-dom';
import ACTIONS from '../Action';

const EditorPage = () => {
    const socketRef = useRef(null);
    const codeRef = useRef('');
    const location = useLocation();
    const { roomId } = useParams();
    const reactNavigator = useNavigate();
    const [clients, setClients] = useState([]);

    useEffect(() => {
        const init = async () => {
            try {
                const socket = await initSocket();
                socketRef.current = socket;

                const handleErrors = (e) => {
                    console.error('Socket error:', e);
                    toast.error('Socket connection failed. Try again.');
                    reactNavigator('/');
                };

                socket.on('connect_error', handleErrors);
                socket.on('connect_failed', handleErrors);

                // JOIN ROOM
                socket.emit(ACTIONS.JOIN, {
                    roomId,
                    username: location.state?.username,
                });

                // ON JOINED
                const handleJoined = ({ clients: incomingClients, username: joinedUsername, socketId }) => {
                    if (joinedUsername !== location.state?.username) {
                        toast.success(`${joinedUsername} joined the room.`);
                    }

                    // Deduplicate clients by socketId
                    const uniqueClients = Array.from(
                        new Map(incomingClients.map(client => [client.socketId, client])).values()
                    );

                    setClients(uniqueClients);

                    if (joinedUsername !== location.state?.username) {
                        socket.emit(ACTIONS.SYNC_CODE, {
                            code: codeRef.current,
                            socketId,
                        });
                    }
                };

                socket.on(ACTIONS.JOINED, handleJoined);

                // ON DISCONNECT
                const handleDisconnected = ({ socketId: disconnectedSocketId, username }) => {
                    toast.success(`${username} left the room.`);
                    setClients((prevClients) =>
                        prevClients.filter((client) => client.socketId !== disconnectedSocketId)
                    );
                };

                socket.on(ACTIONS.DISCONNECTED, handleDisconnected);

                // Clean up on unmount
                return () => {
                    socket.disconnect();
                    socket.off('connect_error', handleErrors);
                    socket.off('connect_failed', handleErrors);
                    socket.off(ACTIONS.JOINED, handleJoined);
                    socket.off(ACTIONS.DISCONNECTED, handleDisconnected);
                };

            } catch (err) {
                console.error('Socket init failed:', err);
                toast.error('Could not connect. Try again later.');
                reactNavigator('/');
            }
        };

        init();
    }, [roomId, reactNavigator, location.state?.username]);

    const copyRoomId = async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID copied to clipboard!');
        } catch (err) {
            toast.error('Failed to copy Room ID');
        }
    };

    const leaveRoom = () => {
        toast.success('You left the room.');
    reactNavigator('/');
    };

    if (!location.state) {
        return <Navigate to="/" />;
    }

    return (
        <div className="mainWrap">
            <div className="aside">
                <div className="asideInner">
                    <div className="logo">
                        <img className="logoImage" src="/logo.png" alt="logo" />
                    </div>
                    <h3>Connected</h3>
                    <div className="clientsList">
                        {clients.map((client) => (
                            <Client key={client.socketId} username={client.username} />
                        ))}
                    </div>
                </div>
                <button className="btn copyBtn" onClick={copyRoomId}>
                    Copy ROOM ID
                </button>
                <button className="btn leaveBtn" onClick={leaveRoom}>
                    Leave
                </button>
            </div>
            <div className="editorWrap">
                <Editor
                    socketRef={socketRef}
                    roomId={roomId}
                    onCodeChange={(code) => {
                        codeRef.current = code;
                    }}
                />
            </div>
        </div>
    );
};

export default EditorPage;
