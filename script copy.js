const recordBtn = document.querySelector(".record"),
  result = document.querySelector(".result"),
  copyTextBtn = document.querySelector(".copy-text"),
  downloadAudioBtn = document.querySelector(".download-audio"),
  inputLanguage = document.querySelector("#language"),
  clearBtn = document.querySelector(".clear"),
  uploadBtn = document.querySelector("#upload-audio");

let SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition,
  recognition,
  recording = false,
  mediaRecorder,
  audioChunks = [],
  recordingTimer,
  recordingDuration = 0,
  offlineChunks = [],
  isOnline = navigator.onLine;

let fullTranscript = "";

// Mendeteksi status online/offline
window.addEventListener("online", () => {
  isOnline = true;
  showNotification("Connection restored. Resuming transcription.", "success");
  if (recording) {
    restartRecognition();
  }
});

window.addEventListener("offline", () => {
  isOnline = false;
  showNotification(
    "Connection lost. Recording will continue but transcription may be delayed.",
    "warning"
  );
});

function populateLanguages() {
  languages.forEach((lang) => {
    const option = document.createElement("option");
    option.value = lang.code;
    option.innerHTML = lang.name;
    inputLanguage.appendChild(option);
  });
}

populateLanguages();

function createAudioPlayer(audioUrl, duration) {
  const audioContainer = document.createElement("div");
  audioContainer.className = "audio-container";
  audioContainer.style.display = "flex";
  audioContainer.style.alignItems = "center";
  audioContainer.style.marginTop = "10px";
  audioContainer.style.padding = "10px";
  audioContainer.style.backgroundColor = "#f0f0f0";
  audioContainer.style.borderRadius = "5px";

  const audioPlayer = document.createElement("audio");
  audioPlayer.src = audioUrl;
  audioPlayer.controls = true;
  audioPlayer.style.flexGrow = "1";

  const durationSpan = document.createElement("span");
  durationSpan.textContent = formatDuration(duration);
  durationSpan.style.marginLeft = "10px";
  durationSpan.style.minWidth = "50px";

  const deleteButton = document.createElement("button");
  deleteButton.textContent = "🗑️";
  deleteButton.style.marginLeft = "10px";
  deleteButton.style.padding = "5px 10px";
  deleteButton.style.border = "none";
  deleteButton.style.borderRadius = "3px";
  deleteButton.style.backgroundColor = "#ff4d4d";
  deleteButton.style.color = "white";
  deleteButton.style.cursor = "pointer";
  deleteButton.onclick = () => {
    audioContainer.remove();
    showNotification("Recording deleted");
  };

  audioContainer.appendChild(audioPlayer);
  audioContainer.appendChild(durationSpan);
  audioContainer.appendChild(deleteButton);

  document.body.appendChild(audioContainer);
}

function formatDuration(seconds) {
  if (!isFinite(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.textContent = message;
  notification.style.position = "fixed";
  notification.style.top = "20px";
  notification.style.left = "50%";
  notification.style.transform = "translateX(-50%)";
  notification.style.padding = "10px 20px";
  notification.style.borderRadius = "5px";
  notification.style.color = "white";
  notification.style.fontWeight = "bold";
  notification.style.zIndex = "1000";
  notification.style.textAlign = "center";
  notification.style.maxWidth = "80%";

  switch (type) {
    case "success":
      notification.style.backgroundColor = "#4CAF50";
      break;
    case "error":
      notification.style.backgroundColor = "#f44336";
      break;
    case "warning":
      notification.style.backgroundColor = "#ff9800";
      break;
    default:
      notification.style.backgroundColor = "#2196F3";
  }

  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transition = "opacity 0.5s ease";
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 3000);
}

function updateRecordingStatus() {
  recordingDuration++;
  const minutes = Math.floor(recordingDuration / 60);
  const seconds = recordingDuration % 60;
  recordBtn.querySelector("p").innerHTML = `Stop Recording (${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")})`;
}

function restartRecognition() {
  if (recognition) {
    recognition.stop();
  }
  speechToText();
}

function speechToText() {
  try {
    recognition = new SpeechRecognition();
    recognition.lang = inputLanguage.value;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 3;

    recordBtn.classList.add("recording");
    recordBtn.querySelector("p").innerHTML = "Stop Recording";
    if (!recordingTimer) {
      recordingDuration = 0;
      recordingTimer = setInterval(updateRecordingStatus, 1000);
    }

    recognition.start();
    showNotification("Recording started", "success");

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      fullTranscript += finalTranscript;
      result.innerHTML =
        fullTranscript +
        '<i style="color: #999;">' +
        interimTranscript +
        "</i>";
      copyTextBtn.disabled = false;
    };

    recognition.onerror = (event) => {
      console.error("Recognition error:", event.error);
      if (event.error === "network") {
        showNotification(
          "Network error. Attempting to restart recognition.",
          "warning"
        );
        setTimeout(restartRecognition, 1000);
      } else {
        showNotification(`Error: ${event.error}. Please try again.`, "error");
      }
    };

    recognition.onend = () => {
      if (recording && isOnline) {
        recognition.start();
      }
    };

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
          mediaRecorder.start();

          mediaRecorder.addEventListener("dataavailable", (event) => {
            audioChunks.push(event.data);
            if (!isOnline) {
              offlineChunks.push(event.data);
            }
          });

          mediaRecorder.addEventListener("stop", () => {
            clearInterval(recordingTimer);
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
            const audioUrl = URL.createObjectURL(audioBlob);

            const audio = new Audio(audioUrl);
            audio.onloadedmetadata = () => {
              if (isFinite(audio.duration)) {
                createAudioPlayer(audioUrl, audio.duration);
              } else {
                createAudioPlayer(audioUrl, 0);
              }
            };

            downloadAudioBtn.disabled = false;
            downloadAudioBtn.onclick = () => {
              const a = document.createElement("a");
              a.style.display = "none";
              a.href = audioUrl;
              a.download = "speech_recording.webm";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            };
            showNotification("Recording saved successfully", "success");
          });
        })
        .catch((error) => {
          console.error("Error accessing microphone:", error);
          showNotification(
            "Error accessing microphone. Please check your permissions.",
            "error"
          );
        });
    }
  } catch (error) {
    console.error("Error initializing speech recognition:", error);
    showNotification(
      "Error initializing speech recognition. Please try again.",
      "error"
    );
    recording = false;
  }
}

recordBtn.addEventListener("click", () => {
  if (!recording) {
    speechToText();
    recording = true;
    recordBtn.classList.add("recording-animation");
  } else {
    stopRecording();
  }
});

function stopRecording() {
  if (recognition) {
    recognition.stop();
  }
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  recordBtn.querySelector("p").innerHTML = "Start Listening";
  recordBtn.classList.remove("recording");
  recordBtn.classList.remove("recording-animation");
  recording = false;
  clearInterval(recordingTimer);
  recordingTimer = null;
  showNotification("Recording stopped", "info");

  // Process offline chunks if any
  if (offlineChunks.length > 0) {
    processOfflineChunks();
  }
}

function processOfflineChunks() {
  const offlineBlob = new Blob(offlineChunks, { type: "audio/webm" });
  const offlineUrl = URL.createObjectURL(offlineBlob);

  // Here you would typically send this blob to your server for processing
  // For demonstration, we'll just create a player for it
  createAudioPlayer(offlineUrl, 0);
  showNotification("Offline recording processed", "info");

  offlineChunks = []; // Clear the offline chunks
}

function copyText() {
  const text = result.innerText;
  navigator.clipboard.writeText(text).then(
    () => {
      showNotification("Text copied to clipboard!", "success");
    },
    (err) => {
      console.error("Could not copy text: ", err);
      showNotification("Failed to copy text", "error");
    }
  );
}

copyTextBtn.addEventListener("click", copyText);

clearBtn.addEventListener("click", () => {
  result.innerHTML = "";
  fullTranscript = "";
  copyTextBtn.disabled = true;
  downloadAudioBtn.disabled = true;
  const audioContainers = document.querySelectorAll(".audio-container");
  audioContainers.forEach((container) => container.remove());
  showNotification("All content cleared", "info");
});

function handleAudioUpload(event) {
  const file = event.target.files[0];
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const reader = new FileReader();

  reader.onload = function (e) {
    audioContext.decodeAudioData(e.target.result, function (buffer) {
      const offlineContext = new OfflineAudioContext(
        buffer.numberOfChannels,
        buffer.length,
        buffer.sampleRate
      );
      const source = offlineContext.createBufferSource();
      source.buffer = buffer;
      source.connect(offlineContext.destination);
      source.start(0);

      offlineContext.startRendering().then(function (renderedBuffer) {
        const blob = new Blob([renderedBuffer], { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(blob);
        createAudioPlayer(audioUrl, renderedBuffer.duration);

        const recognition = new SpeechRecognition();
        recognition.lang = inputLanguage.value;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;

        recognition.onresult = function (event) {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + " ";
            } else {
              interimTranscript += transcript;
            }
          }

          fullTranscript += finalTranscript;
          result.innerHTML =
            fullTranscript +
            '<i style="color: #999;">' +
            interimTranscript +
            "</i>";
          copyTextBtn.disabled = false;
        };

        recognition.onerror = function (event) {
          console.error("Error occurred in recognition: " + event.error);
          showNotification(
            `Error in speech recognition: ${event.error}`,
            "error"
          );
        };

        recognition.onend = function () {
          showNotification("Finished processing uploaded audio", "success");
        };

        const audio = new Audio(audioUrl);
        audio.onended = function () {
          recognition.stop();
        };

        recognition.start();
        audio.play();
        showNotification("Processing uploaded audio...", "info");
      });
    });
  };

  reader.readAsArrayBuffer(file);
}

uploadBtn.addEventListener("change", handleAudioUpload);

// Ensure recording continues even when the page is not visible
document.addEventListener("visibilitychange", () => {
  if (document.hidden && recording) {
    showNotification("Recording continues in background", "info");
  }
});

// Keep the device awake while recording
let wakeLock = null;
async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      console.log("Wake Lock was released");
    });
    console.log("Wake Lock is active");
  } catch (err) {
    console.error(`${err.name}, ${err.message}`);
  }
}

// Release wake lock when recording stops or page is unloaded
function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => {
      wakeLock = null;
    });
  }
}

window.addEventListener("beforeunload", () => {
  if (recognition) {
    recognition.stop();
  }
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  releaseWakeLock();
});

function adjustForMobile() {
  if (window.innerWidth <= 600) {
    document.body.style.padding = "10px";
    result.style.fontSize = "14px";
    recordBtn.style.fontSize = "14px";
    copyTextBtn.style.fontSize = "14px";
    downloadAudioBtn.style.fontSize = "14px";
    clearBtn.style.fontSize = "14px";
  } else {
    document.body.style.padding = "20px";
    result.style.fontSize = "16px";
    recordBtn.style.fontSize = "16px";
    copyTextBtn.style.fontSize = "16px";
    downloadAudioBtn.style.fontSize = "16px";
    clearBtn.style.fontSize = "16px";
  }
}

window.addEventListener("resize", adjustForMobile);
adjustForMobile();

// Fungsi untuk menyimpan state rekaman
function saveRecordingState() {
  const state = {
    fullTranscript,
    recordingDuration,
    isRecording: recording,
    language: inputLanguage.value,
  };
  localStorage.setItem("recordingState", JSON.stringify(state));
}

// Fungsi untuk memulihkan state rekaman
function restoreRecordingState() {
  const savedState = localStorage.getItem("recordingState");
  if (savedState) {
    const state = JSON.parse(savedState);
    fullTranscript = state.fullTranscript;
    recordingDuration = state.recordingDuration;
    inputLanguage.value = state.language;
    result.innerHTML = fullTranscript;
    if (state.isRecording) {
      speechToText();
    }
  }
}

// Simpan state setiap 5 detik
setInterval(saveRecordingState, 5000);

// Coba pulihkan state saat halaman dimuat
window.addEventListener("load", restoreRecordingState);

// Fungsi untuk menangani kesalahan jaringan
function handleNetworkError() {
  showNotification(
    "Network error detected. Attempting to reconnect...",
    "warning"
  );
  setTimeout(() => {
    if (navigator.onLine) {
      restartRecognition();
    } else {
      handleNetworkError();
    }
  }, 5000);
}

// Tambahkan event listener untuk kesalahan jaringan
window.addEventListener("offline", handleNetworkError);

// Fungsi untuk mengoptimalkan penggunaan memori
function optimizeMemoryUsage() {
  if (fullTranscript.length > 1000000) {
    // Jika transkrip lebih dari 1 juta karakter
    const truncatedTranscript = fullTranscript.slice(-500000); // Simpan 500.000 karakter terakhir
    fullTranscript = "... (truncated) " + truncatedTranscript;
    result.innerHTML = fullTranscript;
    showNotification("Transcript truncated to optimize memory usage", "info");
  }
}

// Panggil fungsi optimasi memori setiap 5 menit
setInterval(optimizeMemoryUsage, 300000);

// Fungsi untuk mengenkripsi data sensitif
function encryptSensitiveData(data) {
  // Implementasi enkripsi sebenarnya harus dilakukan di sisi server
  // Ini hanya simulasi enkripsi sederhana
  return btoa(data);
}

// Fungsi untuk mendekripsi data sensitif
function decryptSensitiveData(encryptedData) {
  // Implementasi dekripsi sebenarnya harus dilakukan di sisi server
  // Ini hanya simulasi dekripsi sederhana
  return atob(encryptedData);
}

// Fungsi untuk menangani data sensitif
function handleSensitiveData() {
  const encryptedTranscript = encryptSensitiveData(fullTranscript);
  // Di sini Anda akan mengirim encryptedTranscript ke server yang aman
  console.log("Encrypted transcript ready for secure transmission");
}

// Panggil handleSensitiveData setiap kali rekaman berhenti
recordBtn.addEventListener("click", () => {
  if (recording) {
    handleSensitiveData();
  }
});

// Fungsi untuk memastikan akurasi tambahan
function ensureAccuracy(transcript) {
  // Di sini Anda bisa menambahkan logika untuk memeriksa dan memperbaiki kesalahan umum
  // Misalnya, memeriksa ejaan nama-nama pejabat, istilah teknis, dll.
  // Ini hanya contoh sederhana
  const corrections = {
    presiden: "Presiden",
    menteri: "Menteri",
    dpr: "DPR",
    "undang-undang": "Undang-Undang",
  };

  Object.keys(corrections).forEach((key) => {
    const regex = new RegExp("\\b" + key + "\\b", "gi");
    transcript = transcript.replace(regex, corrections[key]);
  });

  return transcript;
}

// Modifikasi fungsi speechToText untuk menggunakan ensureAccuracy
recognition.onresult = (event) => {
  let interimTranscript = "";
  let finalTranscript = "";

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcript = event.results[i][0].transcript;
    if (event.results[i].isFinal) {
      finalTranscript += ensureAccuracy(transcript) + " ";
    } else {
      interimTranscript += transcript;
    }
  }

  fullTranscript += finalTranscript;
  result.innerHTML =
    fullTranscript + '<i style="color: #999;">' + interimTranscript + "</i>";
  copyTextBtn.disabled = false;
};

// Fungsi untuk membuat backup otomatis
function createAutomaticBackup() {
  const backupData = {
    transcript: fullTranscript,
    timestamp: new Date().toISOString(),
  };
  const backupString = JSON.stringify(backupData);
  const backupBlob = new Blob([backupString], { type: "application/json" });
  const backupUrl = URL.createObjectURL(backupBlob);

  const a = document.createElement("a");
  a.style.display = "none";
  a.href = backupUrl;
  a.download = `transcript_backup_${backupData.timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  showNotification("Automatic backup created", "info");
}

// Buat backup otomatis setiap 15 menit
setInterval(createAutomaticBackup, 900000);

// Inisialisasi aplikasi
function initApp() {
  restoreRecordingState();
  requestWakeLock();
  adjustForMobile();
  showNotification("Application initialized and ready", "success");
}

// Panggil initApp saat halaman dimuat
window.addEventListener("load", initApp);
