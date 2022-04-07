import React, { useEffect, useState, useRef, useReducer } from "react";
import "./App.css";
import io from "socket.io-client";
import Peer from "simple-peer";
import styled from "styled-components";
import {
	Grid,
	Box,
	Button,
	Paper,
	InputBase,
	IconButton,
	Card,
	Divider,
	CardContent,
	CardHeader,
	Chip,
	Backdrop,
	Fab,
	List,
	ListItem,
	Icon,
	ListItemText,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import CallIcon from "@material-ui/icons/Call";
import VideoCallIcon from "@material-ui/icons/VideoCall";
import PermIdentityIcon from "@material-ui/icons/PermIdentity";
import CallEndIcon from "@material-ui/icons/CallEnd";
import { useSnackbar } from "notistack";

const Video = styled.video`
	border: 1px solid blue;
	width: 50%;
	height: 50%;
`;

const useStyles = makeStyles((theme) => ({
	root: {
		height: "100%",
		display: "flex",
		flexDirection: "column",
		flexGrow: 1,
	},
	"id-overlay": {
		position: "fixed",
		height: "100%",
		width: "100%",
		display: "flex",
		flexDirection: "column",
		justifyContent: "center",
		alignItems: "center",
	},
	input: {
		marginLeft: theme.spacing(1),
		flex: 1,
	},
	iconButton: {
		padding: 10,
	},
	incomingCallNoti: {
		zIndex: 1000,
	},
	button: {
		margin: theme.spacing(1),
	},
	fabEnd: {
		display: "none",
		[theme.breakpoints.up("md")]: {
			marginLeft: "8px",
			display: "block",
		},
	},
}));

function App() {
	const [yourID, setYourID] = useState("");
	const [users, setUsers] = useState({});
	const [stream, setStream] = useState(null);
	const [receivingCall, setReceivingCall] = useState(false);
	const [outgoingCall, setOutgoingCall] = useState(false);
	const [caller, setCaller] = useState("");
	const [callee, setCallee] = useState("");
	const [callerSignal, setCallerSignal] = useState(null);
	const [callAccepted, setCallAccepted] = useState(false);
	const { enqueueSnackbar } = useSnackbar();
	const [inpId, setinpId] = useState("");
	const [inpMsg, setinpMsg] = useState("");
	const [messages, setMessages] = useReducer((messages, { value }) => {
		return [...messages, value];
	}, []);

	const classes = useStyles();
	const userVideo = useRef();
	const partnerVideo = useRef();
	const socket = useRef();
	const messagesDiv = useRef(null);

	useEffect(() => {
		socket.current = io.connect("/");

		socket.current.on("yourID", (id) => {
			setYourID(id);
		});
		socket.current.on("allUsers", (users) => {
			setUsers(users);
		});

		socket.current.on("hey", (data) => {
			setReceivingCall(true);
			setCaller(data.from);
			setCallerSignal(data.signal);
		});

		socket.current.on("message", (data) => {
			setMessages({ value: data });
		});
	}, []);

	async function getCamera() {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: true,
			audio: true,
		});
		setStream(stream);
		if (userVideo.current) {
			userVideo.current.srcObject = stream;
		}
		return stream;
	}

	function resetConnection(stream) {
		if (stream) stream.getTracks().forEach((track) => track.stop());
		setStream(null);
		setReceivingCall(false);
		setOutgoingCall(false);
		setCaller("");
		setCallee("");
		setCallerSignal(null);
		setCallAccepted(false);
	}

	function callPeer(id) {
		if (id === null || id === undefined || id === "") return;
		if (id === yourID || !(id in users)) {
			enqueueSnackbar("Please enter a valid id", { variant: "error" });
			return;
		}

		getCamera()
			.then((stream) => {
				setOutgoingCall(true);

				const peer = new Peer({
					initiator: true,
					trickle: false,
					stream: stream,
				});

				peer.on("signal", (data) => {
					socket.current.emit("callUser", {
						userToCall: id,
						signalData: data,
						from: yourID,
					});
				});

				peer.on("stream", (stream) => {
					if (partnerVideo.current) {
						partnerVideo.current.srcObject = stream;
					}
				});

				socket.current.on("callAccepted", (signal) => {
					setCallAccepted(true);
					peer.signal(signal);
				});

				socket.current.on("callDeclined", () => {
					enqueueSnackbar("Call declined", { variant: "error" });
					setOutgoingCall(false);
					setCallee("");
					stream.getTracks().forEach((track) => track.stop());
				});

				socket.current.on("callCancelled", () => {
					setReceivingCall(false);
					setCaller("");
					setCallerSignal(null);
				});
			})
			.catch((err) => {
				enqueueSnackbar("Cannot place call", { variant: "error" });
			});
	}

	function acceptCall() {
		getCamera()
			.then((stream) => {
				setCallAccepted(true);

				const peer = new Peer({
					initiator: false,
					trickle: false,
					stream: stream,
				});

				peer.on("signal", (data) => {
					socket.current.emit("acceptCall", { signal: data, to: caller });
				});

				peer.on("stream", (stream) => {
					partnerVideo.current.srcObject = stream;
				});

				peer.signal(callerSignal);
			})
			.catch((err) => {
				enqueueSnackbar("Cannot accept call", { variant: "error" });
			});
	}

	let UserVideo;
	if (stream) {
		UserVideo = (
			<Video
				playsInline
				muted
				ref={userVideo}
				autoPlay
				style={{
					width: "20%",
					height: "20%",
					border: "none",
					position: "absolute",
					top: "10px",
					left: "10px",
				}}
			/>
		);
	}

	let PartnerVideo;
	if (callAccepted) {
		PartnerVideo = (
			<Video
				playsInline
				ref={partnerVideo}
				autoPlay
				style={{
					width: "100%",
					border: "none",
				}}
			/>
		);
	}

	const handleSubmit = (e) => {
		e.preventDefault();
		callPeer(inpId);
		setCallee(inpId);
		setinpId("");
	};

	const copyId = () => {
		navigator.clipboard.writeText(yourID).then(() => {
			enqueueSnackbar("Copied");
		});
	};

	const onSendMessage = (e) => {
		const messageToSend = inpMsg;
		const data = {
			to: caller !== "" ? caller : callee,
			message: messageToSend,
		};
		setinpMsg("");
		setMessages({ value: data.message });
		socket.current.emit("message", data);
	};

	console.log("god or what")

	return (
		<>
			<Grid
				container
				style={{ display: callAccepted ? "flex" : "none", height: "100%" }}
			>
				<Grid item xs={12} sm={7} style={{ maxHeight: "100vh" }}>
					<Box display="flex" flexDirection="column" position="relative">
						{PartnerVideo}
						{UserVideo}
						<div style={{ position: "absolute", left: "50%", bottom: "8px" }}>
							<Fab
								variant="extended"
								color="secondary"
								style={{ position: "relative", left: "-50%" }}
								onClick={() => {
									resetConnection(stream);
								}}
							>
								<CallEndIcon />
								<span className={classes.fabEnd}>End</span>
							</Fab>
						</div>
					</Box>
				</Grid>
				<Grid item xs={12} sm={5}>
					<Box
						display="flex"
						flexDirection="column"
						position="relative"
						paddingLeft="8px"
						height="100%"
					>
						<h5>Messages</h5>
						<div
							ref={messagesDiv}
							style={{
								flexGrow: 1,
							}}
						>
							<List
								style={{
									maxHeight: messagesDiv.current
										? messagesDiv.current.clientHeight
										: 0,
									overflowY: "auto",
								}}
							>
								{messages.map((message, pos) => (
									<ListItem key={pos}>
										<ListItemText primary={message} />
									</ListItem>
								))}
							</List>
						</div>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								onSendMessage();
							}}
							noValidate
							autoComplete="off"
							style={{
								width: "100%",
								padding: "8px",
								display: "flex",
								flexWrap: "wrap",
							}}
						>
							<InputBase
								multiline
								rows="3"
								value={inpMsg}
								onChange={(e) => {
									setinpMsg(e.target.value);
								}}
								placeholder="Enter message"
								inputProps={{ "aria-label": "Enter message" }}
								style={{
									padding: "8px",
									border: "1px grey solid",
									borderRadius: "4px",
									width: "100%",
								}}
							/>
							<Button
								type="submit"
								variant="contained"
								color="primary"
								style={{ margin: "8px 0 0 auto" }}
								endIcon={<Icon>send</Icon>}
							>
								Send
							</Button>
						</form>
					</Box>
				</Grid>
			</Grid>
			<div
				className={classes.root}
				style={{ display: callAccepted ? "none" : "flex" }}
			>
				<div className={classes["id-overlay"]}>
					<Card style={{ padding: "24px" }} elevation={5}>
						<CardHeader
							title={
								<>
									<IconButton
										type="submit"
										className={classes.iconButton}
										aria-label="search"
									>
										<VideoCallIcon />
									</IconButton>
									p2p video chat
								</>
							}
						></CardHeader>
						<CardContent>
							<Paper component="form" elevation={0} onSubmit={handleSubmit}>
								<IconButton type="submit" className={classes.iconButton}>
									<PermIdentityIcon />
								</IconButton>
								<InputBase
									value={inpId}
									onChange={(e) => {
										setinpId(e.target.value);
									}}
									className={classes.input}
									placeholder="Enter unique id to call"
									inputProps={{ "aria-label": "Enter unique id to call" }}
								/>
								<Button
									className={classes.input}
									variant="contained"
									color="primary"
									type="submit"
									startIcon={<CallIcon />}
								>
									Call
								</Button>
							</Paper>
						</CardContent>
						<Divider />
						<br />
						<span style={{ color: "#000000aa" }}>
							Share your id with your friend to connect
						</span>
						<div style={{ dislpay: "flex", marginTop: "8px" }}>
							<span
								style={{
									fontSize: "1.2rem",
									marginRight: "8px",
								}}
							>
								Your id: <em>{yourID}</em>
							</span>
							<Chip label="copy" variant="outlined" onClick={copyId} />
						</div>
					</Card>
				</div>
			</div>
			<Backdrop
				className={classes.incomingCallNoti}
				open={receivingCall && !callAccepted}
			>
				<Card elevation={5}>
					<CardContent>
						<h5>
							<VideoCallIcon /> Incoming call
						</h5>
						from
						<h6>
							<em>{caller}</em>
						</h6>
						<Divider style={{ width: "100%", marginBottom: "16px" }} />
						<Button
							className={classes.button}
							variant="contained"
							color="primary"
							onClick={acceptCall}
						>
							Accept
						</Button>
						<Button
							className={classes.button}
							variant="contained"
							color="secondary"
							onClick={() => {
								setReceivingCall(false);
								setCaller("");
								setCallerSignal(null);
								socket.current.emit("declineCall", { to: caller });
							}}
						>
							Decline
						</Button>
					</CardContent>
				</Card>
			</Backdrop>
			<Backdrop
				className={classes.incomingCallNoti}
				open={outgoingCall && !callAccepted}
			>
				<Card elevation={5}>
					<CardContent>
						<h5>
							<VideoCallIcon /> Calling
						</h5>
						<h6>
							<em>{callee}</em>
						</h6>
						<Divider style={{ width: "100%", marginBottom: "16px" }} />
						<Button
							variant="contained"
							color="secondary"
							onClick={() => {
								setOutgoingCall(false);
								socket.current.emit("cancelCall", { to: callee });
								stream.getTracks().forEach((track) => track.stop());
							}}
						>
							Cancel
						</Button>
					</CardContent>
				</Card>
			</Backdrop>
		</>
	);
}

export default App;
