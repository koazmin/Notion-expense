<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Burmese Voice Expense Tracker</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* Custom styles for a cleaner look */
        body {
            font-family: 'Inter', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
            /* Financial Theme Background */
            background-image: url('https://placehold.co/1920x1080/1A202C/E0E0E0?text=Financial+Abstract+Background');
            background-size: cover;
            background-position: center;
            background-attachment: fixed;
            position: relative;
            z-index: 0;
        }

        /* Overlay for lower transparency effect */
        body::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(26, 32, 44, 0.7);
            /* Dark blue-gray overlay with 70% opacity */
            z-index: -1;
        }

        .container {
            background-color: rgba(255, 255, 255, 0.95);
            /* Slightly transparent white container */
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            padding: 30px;
            width: 100%;
            max-width: 700px;
            /* Slightly wider for data display */
            z-index: 1;
            position: relative;
        }

        .button-group button {
            transition: background-color 0.2s, transform 0.1s;
        }

        .button-group button:hover {
            transform: translateY(-2px);
        }

        .button-group button:active {
            transform: translateY(0);
        }

        .recording-indicator {
            animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
            0% {
                transform: scale(1);
                opacity: 1;
            }

            50% {
                transform: scale(1.05);
                opacity: 0.7;
            }

            100% {
                transform: scale(1);
                opacity: 1;
            }
        }
    </style>
</head>

<body class="bg-gray-100 min-h-screen flex items-center justify-center">
    <div class="container flex flex-col items-center space-y-6">
        <h1 class="text-3xl font-bold text-gray-800 mb-4">Burmese Voice Expense Tracker</h1>

        <div id="statusMessage" class="text-center text-sm font-medium text-gray-600 min-h-[20px]">Ready to record your
            transaction voice note.</div>

        <div class="button-group flex flex-wrap justify-center gap-4 w-full">
            <button id="startRecord"
                class="bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-300 flex items-center justify-center">
                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 11a7 7 0 01-7 7v1m0 0v1m0-1a7 7 0 01-7-7m7 7v-1m0 0V5a2 2 0 012-2h4a2 2 0 012 2v6a2 2 0 01-2 2h-4a2 2 0 01-2-2z">
                    </path>
                </svg>
                Start Recording
            </button>

            <button id="stopRecord" disabled
                class="bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg opacity-50 cursor-not-allowed hover:bg-red-600 focus:outline-none focus:ring-4 focus:ring-red-300 flex items-center justify-center">
                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 10H7v4h2v-4zm8 0h-2v4h2v-4z"></path>
                </svg>
                Stop Recording
            </button>

            <button id="transcribeExtractBtn" disabled
                class="bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg opacity-50 cursor-not-allowed hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 flex items-center justify-center">
                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M8 7H5a2 2 0 00-2 2v6a2 2 0 002 2h3m0-1V7m0 0h8a2 2 0 012 2v6a2 2 0 01-2 2h-8m0-9v9m6-10l4 4-4 4">
                    </path>
                </svg>
                Transcribe &amp; Extract
            </button>
        </div>

        <audio id="audioPlayer" class="w-full mt-4 hidden" controls></audio>

        <div class="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 mt-6">
            <h2 class="text-xl font-semibold text-gray-700 mb-3">Transaction Details (Review/Edit):</h2>
            <label for="transcriptInput" class="block text-sm font-medium text-gray-700 mb-1">Original Voice Note:</label>
            <textarea id="transcriptInput"
                class="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y text-gray-800 text-base leading-relaxed min-h-[80px] mb-3"
                rows="3" placeholder="Your transcribed or manually entered voice note will appear here."></textarea>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label for="amountInput" class="block text-sm font-medium text-gray-700 mb-1">Amount:</label>
                    <input type="number" id="amountInput" placeholder="e.g., 5000"
                        class="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-800">
                </div>
                <div>
                    <label for="typeInput" class="block text-sm font-medium text-gray-700 mb-1">Type:</label>
                    <select id="typeInput"
                        class="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-800 bg-white">
                        <option value="Expense">Expense</option>
                        <option value="Income">Income</option>
                    </select>
                </div>
                <div>
                    <label for="categoryInput" class="block text-sm font-medium text-gray-700 mb-1">Category:</label>
                    <select id="categoryInput"
                        class="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-800 bg-white">
                        <option value="Food">Food</option>
                        <option value="Transport">Transport</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Rent">Rent</option>
                        <option value="Salary">Salary</option>
                        <option value="Gift">Gift</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Education">Education</option>
                        <option value="Other">Other</option>
                        <option value="Mahar Unity">Mahar Unity</option>
                        <option value="Bavin">Bavin</option>
                    </select>
                </div>
                <div>
                    <label for="dateInput" class="block text-sm font-medium text-gray-700 mb-1">Date:</label>
                    <input type="date" id="dateInput"
                        class="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-800">
                </div>
            </div>
            <label for="notesInput" class="block text-sm font-medium text-gray-700 mt-4 mb-1">Additional Notes:</label>
            <textarea id="notesInput"
                class="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y text-gray-800 text-base leading-relaxed min-h-[60px]"
                rows="2" placeholder="Additional details for the transaction."></textarea>
        </div>

        <div class="flex flex-wrap justify-center gap-4 w-full mt-4">
            <button id="copyOriginalTextBtn" disabled
                class="bg-gray-700 text-white px-6 py-3 rounded-xl shadow-lg opacity-50 cursor-not-allowed hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-300 flex items-center justify-center">
                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4a2 2 0 012 2v4m-5 4l-4-4"></path>
                </svg>
                Copy Original Text
            </button>

            <button id="saveToNotionBtn" disabled
                class="bg-indigo-600 text-white px-6 py-3 rounded-xl shadow-lg opacity-50 cursor-not-allowed hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 flex items-center justify-center">
                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                    </path>
                </svg>
                Save to Notion
            </button>
        </div>

    </div>

    <script>
        // DOM Elements
        const startRecordBtn = document.getElementById('startRecord');
        const stopRecordBtn = document.getElementById('stopRecord');
        // Renamed from processAudioBtn to transcribeExtractBtn
        const transcribeExtractBtn = document.getElementById('transcribeExtractBtn');
        const audioPlayer = document.getElementById('audioPlayer');
        const transcriptInput = document.getElementById('transcriptInput'); // Original text/transcript
        const amountInput = document.getElementById('amountInput');
        const typeInput = document.getElementById('typeInput');
        const categoryInput = document.getElementById('categoryInput');
        const dateInput = document.getElementById('dateInput');
        const notesInput = document.getElementById('notesInput'); // For additional notes
        const statusMessage = document.getElementById('statusMessage');
        const copyOriginalTextBtn = document.getElementById('copyOriginalTextBtn');
        const saveToNotionBtn = document.getElementById('saveToNotionBtn');

        // MediaRecorder variables
        let mediaRecorder;
        let audioChunks = [];
        let audioBlob = null;
        let audioUrl = null;

        // Helper to format date for input
        function getTodayDateString() {
            const today = new Date();
            const year = today.getFullYear();
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const day = today.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        // Function to update button states and messages
        function updateUI(state) {
            startRecordBtn.disabled = true;
            stopRecordBtn.disabled = true;
            transcribeExtractBtn.disabled = true; // Use new name
            copyOriginalTextBtn.disabled = true;
            saveToNotionBtn.disabled = true;

            startRecordBtn.classList.add('opacity-50', 'cursor-not-allowed');
            stopRecordBtn.classList.add('opacity-50', 'cursor-not-allowed');
            transcribeExtractBtn.classList.add('opacity-50', 'cursor-not-allowed'); // Use new name
            copyOriginalTextBtn.classList.add('opacity-50', 'cursor-not-allowed');
            saveToNotionBtn.classList.add('opacity-50', 'cursor-not-allowed');

            startRecordBtn.classList.remove('recording-indicator');

            audioPlayer.src = ''; // Clear previous audio src
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl); // Clean up previous object URL
                audioUrl = null;
            }

            switch (state) {
                case 'ready':
                    startRecordBtn.disabled = false;
                    startRecordBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    statusMessage.textContent = 'Ready to record your transaction voice note.';
                    transcriptInput.value = '';
                    amountInput.value = '';
                    typeInput.value = 'Expense'; // Default to Expense
                    categoryInput.value = 'Other'; // Default category
                    dateInput.value = getTodayDateString(); // Set to today's date
                    notesInput.value = '';
                    audioBlob = null;
                    audioChunks = [];
                    break;
                case 'recording':
                    stopRecordBtn.disabled = false;
                    stopRecordBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    startRecordBtn.classList.add('recording-indicator');
                    statusMessage.textContent = 'Recording... Describe your expense or income!';
                    transcriptInput.value = ''; // Clear transcript on new recording
                    amountInput.value = '';
                    notesInput.value = '';
                    break;
                case 'recorded':
                    transcribeExtractBtn.disabled = false; // Use new name
                    transcribeExtractBtn.classList.remove('opacity-50', 'cursor-not-allowed'); // Use new name
                    statusMessage.textContent = 'Recording stopped. Transcribe & Extract details.';
                    break;
                case 'transcribing': // New state for transcription
                    statusMessage.textContent = 'Transcribing and extracting data... Please wait.';
                    transcriptInput.value = 'Processing audio...';
                    amountInput.value = '';
                    notesInput.value = '';
                    break;
                case 'data_ready_for_review': // New state after transcription/extraction, before Notion save
                    startRecordBtn.disabled = false; // Allow new recording
                    startRecordBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    copyOriginalTextBtn.disabled = false;
                    copyOriginalTextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    saveToNotionBtn.disabled = false;
                    saveToNotionBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    statusMessage.textContent = 'Transaction details ready for review. Edit fields and save to Notion.';
                    break;
                case 'saving_to_notion':
                    statusMessage.textContent = 'Saving transaction to Notion...';
                    // Keep input fields enabled for review while saving is in progress
                    // but disable save button to prevent double-click
                    saveToNotionBtn.disabled = true;
                    saveToNotionBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    break;
                case 'saved':
                    statusMessage.textContent = 'Successfully saved to Notion!';
                    updateUI('ready'); // Reset after successful save
                    break;
                case 'error':
                    statusMessage.textContent = 'An error occurred. Please try again.';
                    startRecordBtn.disabled = false;
                    startRecordBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    // In case of error, re-enable buttons that allow user to retry or interact
                    if (transcriptInput.value.trim() !== '' || amountInput.value.trim() !== '') {
                        saveToNotionBtn.disabled = false;
                        saveToNotionBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                    if (transcriptInput.value.trim() !== '') {
                        copyOriginalTextBtn.disabled = false;
                        copyOriginalTextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                    break;
            }
        }

        // Initialize UI on load
        document.addEventListener('DOMContentLoaded', () => {
            updateUI('ready');
            // Add event listeners for manual input changes to enable Save button
            [transcriptInput, amountInput, typeInput, categoryInput, dateInput, notesInput].forEach(input => {
                input.addEventListener('input', () => {
                    // Only enable save if amount is valid and essential fields are filled after initial processing
                    const isAmountValid = !isNaN(parseFloat(amountInput.value)) && parseFloat(amountInput.value) > 0;
                    const areFieldsFilled = transcriptInput.value.trim() !== '' && typeInput.value.trim() !== '' && categoryInput.value.trim() !== '' && dateInput.value.trim() !== '';

                    if (isAmountValid && areFieldsFilled) {
                        saveToNotionBtn.disabled = false;
                        saveToNotionBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    } else {
                        saveToNotionBtn.disabled = true;
                        saveToNotionBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    }
                    // Enable copy button only if original transcript exists
                    if (transcriptInput.value.trim() !== '') {
                        copyOriginalTextBtn.disabled = false;
                        copyOriginalTextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    } else {
                        copyOriginalTextBtn.disabled = true;
                        copyOriginalTextBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    }
                });
            });
        });

        // Event listener for starting recording
        startRecordBtn.addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = () => {
                    audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    if (audioBlob.size === 0) {
                        console.error('Recorded audio Blob is empty!');
                        statusMessage.textContent = 'Recording failed: No audio captured. Try again.';
                        updateUI('error');
                        stream.getTracks().forEach(track => track.stop());
                        return;
                    }

                    audioUrl = URL.createObjectURL(audioBlob);
                    console.log('Audio Blob created:', audioBlob.type, audioBlob.size, 'bytes. URL:', audioUrl);
                    updateUI('recorded');
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                updateUI('recording');

            } catch (err) {
                console.error('Error accessing microphone:', err);
                statusMessage.textContent = 'Error: Could not access microphone. Please allow access.';
                updateUI('error');
            }
        });

        // Event listener for stopping recording
        stopRecordBtn.addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        });

        // Event listener for Transcribe & Extract button
        transcribeExtractBtn.addEventListener('click', async () => {
            if (!audioBlob) {
                statusMessage.textContent = 'No audio recorded to process.';
                return;
            }

            updateUI('transcribing'); // New state for transcription

            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = reader.result.split(',')[1];

                try {
                    // Call the new API endpoint for transcription and extraction only
                    const response = await fetch('/api/transcribe-process', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            audio: base64Audio,
                            mimeType: audioBlob.type,
                        }),
                    });

                    const data = await response.json();

                    if (response.ok) {
                        // Populate the form fields with the extracted data
                        transcriptInput.value = data.originalTranscript || 'No original transcript returned.';
                        amountInput.value = data.extractedData.amount;
                        typeInput.value = data.extractedData.type;
                        categoryInput.value = data.extractedData.category;
                        dateInput.value = data.extractedData.date;
                        notesInput.value = data.extractedData.note || data.originalTranscript; // Use 'note' from Gemini

                        updateUI('data_ready_for_review'); // New state
                    } else {
                        throw new Error(data.error || 'Unknown error from API.');
                    }
                } catch (error) {
                    console.error('Error sending audio to API for processing:', error);
                    statusMessage.textContent = `Error processing audio: ${error.message}`;
                    // Reset fields on error
                    transcriptInput.value = '';
                    amountInput.value = '';
                    typeInput.value = 'Expense';
                    categoryInput.value = 'Other';
                    dateInput.value = getTodayDateString();
                    notesInput.value = '';
                    updateUI('error');
                }
            };
            reader.onerror = (error) => {
                console.error('Error reading audio Blob:', error);
                statusMessage.textContent = 'Error processing audio for transcription.';
                updateUI('error');
            };
        });

        // Event listener for Copy Original Text button
        copyOriginalTextBtn.addEventListener('click', () => {
            if (transcriptInput.value.trim() !== '') {
                // Select the text in the textarea
                transcriptInput.select();
                transcriptInput.setSelectionRange(0, 99999); // For mobile devices

                try {
                    // Execute copy command
                    const success = document.execCommand('copy');
                    if (success) {
                        statusMessage.textContent = 'Original text copied to clipboard!';
                    } else {
                        statusMessage.textContent = 'Failed to copy text. Please copy manually.';
                        console.error('document.execCommand("copy") returned false.');
                    }
                } catch (err) {
                    console.error('Failed to copy text (exception): ', err);
                    statusMessage.textContent = 'Failed to copy text. Please copy manually.';
                } finally {
                    // Deselect text and restore focus
                    transcriptInput.setSelectionRange(0, 0); // Deselect
                    transcriptInput.focus();
                }
            } else {
                statusMessage.textContent = 'No text to copy.';
            }
        });


        // Event listener for Save to Notion button
        saveToNotionBtn.addEventListener('click', async () => {
            // Get values from the editable form fields
            const manualAmount = parseFloat(amountInput.value);
            const manualType = typeInput.value;
            const manualCategory = categoryInput.value;
            const manualDate = dateInput.value;
            const manualNotes = notesInput.value.trim(); // The notes field
            const originalTranscript = transcriptInput.value.trim(); // The raw voice note/text

            // Basic validation for manual inputs
            if (isNaN(manualAmount) || manualAmount <= 0) {
                statusMessage.textContent = 'Please enter a valid amount greater than 0.';
                return;
            }

            if (!manualType || !manualCategory || !manualDate) {
                statusMessage.textContent = 'Please ensure Type, Category, and Date are selected.';
                return;
            }

            updateUI('saving_to_notion');

            try {
                // Send the *edited* data to the new save API endpoint
                const response = await fetch('/api/save-transaction', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        // Send the current values from the form
                        transcript: originalTranscript, // The original/edited transcript
                        extractedData: { // Pass as a structured object
                            amount: manualAmount,
                            type: manualType,
                            category: manualCategory,
                            date: manualDate,
                            note: manualNotes, // Use 'note' to match Gemini's output
                        }
                    }),
                });

                const data = await response.json();

                if (response.ok) {
                    statusMessage.textContent = `Saved "${data.extractedData.type}: ${data.extractedData.amount}" to Notion!`;
                    updateUI('saved');
                } else {
                    throw new Error(data.error || 'Unknown error from API.');
                }
            } catch (error) {
                console.error('Error saving data to Notion:', error);
                statusMessage.textContent = `Error saving: ${error.message}`;
                updateUI('error');
            }
        });
    </script>
</body>

</html>
