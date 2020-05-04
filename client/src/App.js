import React, { useEffect, useState, useRef } from "react";
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
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import CallIcon from "@material-ui/icons/Call";
import VideoCallIcon from "@material-ui/icons/VideoCall";
import PermIdentityIcon from "@material-ui/icons/PermIdentity";
import { useSnackbar } from "notistack";

const Row = styled.div`
	display: flex;
	width: 100%;
`;

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
}));

function App() {
	const [yourID, setYourID] = useState("");
	const [users, setUsers] = useState({});
	const [stream, setStream] = useState();
	const [receivingCall, setReceivingCall] = useState(false);
	const [caller, setCaller] = useState("");
	const [callerSignal, setCallerSignal] = useState();
	const [callAccepted, setCallAccepted] = useState(false);
	const { enqueueSnackbar } = useSnackbar();
	const [inpId, setinpId] = React.useState("");

	const classes = useStyles();
	const userVideo = useRef();
	const partnerVideo = useRef();
	const socket = useRef();

	useEffect(() => {
		socket.current = io.connect("/");
		navigator.mediaDevices
			.getUserMedia({ video: true, audio: true })
			.then((stream) => {
				setStream(stream);
				if (userVideo.current) {
					userVideo.current.srcObject = stream;
				}
			});

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
	}, []);

	function callPeer(id) {
		if (id === null || id === undefined || id === "") return;
		if (id === yourID || !(id in users)) {
			enqueueSnackbar("Please enter a valid id", { variant: "error" });
			return;
		}
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
	}

	function acceptCall() {
		setCallAccepted(true);
		const peer = new Peer({ initiator: false, trickle: false, stream: stream });
		peer.on("signal", (data) => {
			socket.current.emit("acceptCall", { signal: data, to: caller });
		});
		peer.on("stream", (stream) => {
			partnerVideo.current.srcObject = stream;
		});
		peer.signal(callerSignal);
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

	let incomingCall;
	if (receivingCall) {
		incomingCall = (
			<div>
				<h1>{caller} is calling you</h1>
				<button onClick={acceptCall}>Accept</button>
			</div>
		);
	}

	const handleSubmit = (e) => {
		e.preventDefault();
		callPeer(inpId);
		setinpId("");
	};

	const copyId = () => {
		navigator.clipboard.writeText(yourID).then(() => {
			enqueueSnackbar("Copied");
		});
	};

	return (
		<>
			<div className={classes.root}>
				<Grid container>
					<Grid item xs={7}>
						<Box display="flex" flexDirection="column" position="relative">
							{PartnerVideo}
							{UserVideo}
						</Box>
					</Grid>
				</Grid>
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
								<IconButton
									type="submit"
									className={classes.iconButton}
									aria-label="search"
								>
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
				<Row>{incomingCall}</Row>
			</div>
		</>
	);
}

export default App;
