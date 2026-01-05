
// FIX 4.4 Protocol Constants & Helper Functions
export const SOH = '|'; // Using pipe for visualization, replaced by \u0001 in real wire proto
export const FIX_VERSION = 'FIX.4.4';

export enum FixTag {
    BeginString = 8,
    BodyLength = 9,
    MsgType = 35,
    MsgSeqNum = 34,
    SenderCompID = 49,
    TargetCompID = 56,
    SendingTime = 52,
    ClOrdID = 11,
    OrigClOrdID = 41, // New: For Cancel/Replace
    HandlInst = 21,
    Symbol = 55,
    Side = 54,
    TransactTime = 60,
    OrderQty = 38,
    OrdType = 40,
    Price = 44,
    CheckSum = 10,
    OrderID = 37,
    ExecID = 17,
    ExecType = 150,
    OrdStatus = 39,
    LeavesQty = 151,
    CumQty = 14,
    AvgPx = 6,
    Text = 58,
    TestReqID = 112
}

export enum FixMsgType {
    Heartbeat = '0',
    TestRequest = '1',
    Logon = 'A',
    NewOrderSingle = 'D',
    OrderCancelRequest = 'F',
    ExecutionReport = '8',
    OrderCancelReject = '9',
    Reject = '3'
}

export const generateChecksum = (messageBody: string): string => {
    let sum = 0;
    for (let i = 0; i < messageBody.length; i++) {
        sum += messageBody.charCodeAt(i);
    }
    const checksum = sum % 256;
    return checksum.toString().padStart(3, '0');
};

export const createFixMessage = (msgType: string, tags: Record<number, string | number>, seqNum: number): string => {
    // 1. Header (excluding BodyLength, Checksum)
    // We construct body first to calc length
    let body = `35=${msgType}${SOH}`;
    body += `34=${seqNum}${SOH}`;
    body += `49=COMMOTRADE${SOH}`; // Sender is Server
    body += `56=${tags[FixTag.TargetCompID] || 'CLIENT'}${SOH}`; // Target is Client
    body += `52=${new Date().toISOString()}${SOH}`;

    // Add business tags
    Object.keys(tags).forEach(key => {
        const tag = parseInt(key);
        if ([8, 9, 10, 35, 34, 49, 56, 52].includes(tag)) return; // Skip headers we just added
        body += `${tag}=${tags[tag]}${SOH}`;
    });

    const header = `8=${FIX_VERSION}${SOH}9=${body.length}${SOH}`;
    const messageWithoutChecksum = header + body;
    const checksum = generateChecksum(messageWithoutChecksum.replace(/\|/g, '\u0001')); // Calc on real values

    return `${messageWithoutChecksum}10=${checksum}${SOH}`;
};

export const parseFixMessage = (raw: string): Record<number, string> => {
    const map: Record<number, string> = {};
    const pairs = raw.split(SOH);
    pairs.forEach(p => {
        const [tag, val] = p.split('=');
        if (tag && val) {
            map[parseInt(tag)] = val;
        }
    });
    return map;
};
