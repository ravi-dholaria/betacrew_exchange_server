const net = require('net');
const fs = require('fs');

// Constants based on server specification
const SERVER_PORT = 3000;
const SERVER_HOST = 'localhost';
const CALL_TYPE_STREAM_ALL = 1;
const CALL_TYPE_RESEND_PACKET = 2;

// Packet structure information from the specification
const PACKET_STRUCTURE = [
  { name: 'symbol', type: 'ascii', size: 4 },
  { name: 'buysellindicator', type: 'ascii', size: 1 },
  { name: 'quantity', type: 'int32', size: 4 },
  { name: 'price', type: 'int32', size: 4 },
  { name: 'packetSequence', type: 'int32', size: 4 },
];

// Calculate total packet size
const PACKET_SIZE = PACKET_STRUCTURE.reduce(
  (size, field) => size + field.size,
  0
);

// Store received packets
const receivedPackets = [];
const receivedSequences = new Set();

// Function to create a request buffer
function createRequestBuffer(callType, resendSeq = 0) {
  const buffer = Buffer.alloc(2);
  buffer.writeInt8(callType, 0);
  buffer.writeInt8(resendSeq, 1);
  return buffer;
}

// Function to parse packet data from buffer
function parsePacket(buffer) {
  let offset = 0;
  const packet = {};

  for (const field of PACKET_STRUCTURE) {
    if (field.type === 'ascii') {
      // ASCII fields need special handling to trim null bytes
      packet[field.name] = buffer
        .toString('ascii', offset, offset + field.size)
        .replace(/\0/g, '');
    } else if (field.type === 'int32') {
      // Read integer values with big endian
      packet[field.name] = buffer.readInt32BE(offset);
    }
    offset += field.size;
  }

  return packet;
}

// Function to find missing sequences in the received packets
function findMissingSequences(maxSeq) {
  const missing = [];
  for (let i = 1; i <= maxSeq; i++) {
    if (!receivedSequences.has(i)) {
      missing.push(i);
    }
  }
  return missing;
}

// Function to request missing packets
function requestMissingPackets(missingSeqs, callback) {
  if (missingSeqs.length === 0) {
    return callback();
  }

  let completedRequests = 0;
  let client;

  const connectAndRequest = (seqNum) => {
    client = new net.Socket();

    client.connect(SERVER_PORT, SERVER_HOST, () => {
      // Send request for specific packet sequence
      const requestBuffer = createRequestBuffer(
        CALL_TYPE_RESEND_PACKET,
        seqNum
      );
      client.write(requestBuffer);
    });

    let dataBuffer = Buffer.alloc(0);

    client.on('data', (data) => {
      // Accumulate data in buffer
      dataBuffer = Buffer.concat([dataBuffer, data]);

      // Process complete packets
      while (dataBuffer.length >= PACKET_SIZE) {
        const packetBuffer = dataBuffer.slice(0, PACKET_SIZE);
        dataBuffer = dataBuffer.slice(PACKET_SIZE);

        const packet = parsePacket(packetBuffer);

        if (!receivedSequences.has(packet.packetSequence)) {
          receivedPackets.push(packet);
          receivedSequences.add(packet.packetSequence);
          console.log(
            `Received missing packet with sequence: ${packet.packetSequence}`
          );
        }
      }

      // Close connection after receiving the packet
      client.end();
    });

    client.on('close', () => {
      completedRequests++;
      if (completedRequests === missingSeqs.length) {
        callback();
      } else {
        // Request next missing sequence
        connectAndRequest(missingSeqs[completedRequests]);
      }
    });

    client.on('error', (err) => {
      console.error(`Error requesting packet ${seqNum}:`, err.message);
      client.destroy();
      completedRequests++;
      if (completedRequests === missingSeqs.length) {
        callback();
      } else {
        // Request next missing sequence
        connectAndRequest(missingSeqs[completedRequests]);
      }
    });
  };

  // Start requesting the first missing sequence
  connectAndRequest(missingSeqs[0]);
}

// Main function to execute the client logic
function main() {
  const client = new net.Socket();

  client.connect(SERVER_PORT, SERVER_HOST, () => {
    console.log('Connected to BetaCrew exchange server');

    // Send request for all packets
    const requestBuffer = createRequestBuffer(CALL_TYPE_STREAM_ALL);
    client.write(requestBuffer);
  });

  let dataBuffer = Buffer.alloc(0);

  client.on('data', (data) => {
    // Accumulate data in buffer
    dataBuffer = Buffer.concat([dataBuffer, data]);

    // Process complete packets
    while (dataBuffer.length >= PACKET_SIZE) {
      const packetBuffer = dataBuffer.slice(0, PACKET_SIZE);
      dataBuffer = dataBuffer.slice(PACKET_SIZE);

      const packet = parsePacket(packetBuffer);
      receivedPackets.push(packet);
      receivedSequences.add(packet.packetSequence);
      console.log(`Received packet with sequence: ${packet.packetSequence}`);
    }
  });

  client.on('close', () => {
    console.log('Connection closed by server');

    // Find the largest sequence number to determine the expected range
    let maxSequence = 0;
    for (const packet of receivedPackets) {
      maxSequence = Math.max(maxSequence, packet.packetSequence);
    }

    // Find missing sequences
    const missingSequences = findMissingSequences(maxSequence);
    console.log(
      `Detected ${
        missingSequences.length
      } missing sequences: ${missingSequences.join(', ')}`
    );

    if (missingSequences.length > 0) {
      // Request missing packets
      console.log('Requesting missing packets...');
      requestMissingPackets(missingSequences, finalizeOutput);
    } else {
      finalizeOutput();
    }
  });

  client.on('error', (err) => {
    console.error('Connection error:', err.message);
  });
}

// Function to sort packets by sequence and save to JSON file
function finalizeOutput() {
  // Sort packets by sequence number
  receivedPackets.sort((a, b) => a.packetSequence - b.packetSequence);

  // Verify all sequences are present
  const allSequencesPresent = receivedPackets.every(
    (packet, index) => packet.packetSequence === index + 1
  );

  if (allSequencesPresent) {
    console.log('All packet sequences received successfully');
  } else {
    console.warn('Warning: There may still be missing sequences in the output');
  }

  // Write packets to JSON file
  const outputPath = './stock_data.json';
  fs.writeFileSync(outputPath, JSON.stringify(receivedPackets, null, 2));
  console.log(`Output saved to ${outputPath}`);
}

// Execute the client
main();
