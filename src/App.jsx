import React, { useState, useEffect, useCallback, useMemo } from 'react';

function App() {
  // 게임 상태
  const [currentTurn, setCurrentTurn] = useState('red'); // 'red' or 'blue'
  const [timer, setTimer] = useState(20);
  // 각 팀 3개의 말: {pos: number, finished: boolean, stack: number[]}
  const [tokensRed, setTokensRed] = useState([
    { pos: 0, finished: false, stack: [] },
    { pos: 0, finished: false, stack: [] },
    { pos: 0, finished: false, stack: [] },
  ]);
  const [tokensBlue, setTokensBlue] = useState([
    { pos: 0, finished: false, stack: [] },
    { pos: 0, finished: false, stack: [] },
    { pos: 0, finished: false, stack: [] },
  ]);
  const [selectedRed, setSelectedRed] = useState(0);
  const [selectedBlue, setSelectedBlue] = useState(0);
  const [view, setView] = useState('menu'); // 'menu' | 'howto' | 'game'
  const [a1, setA1] = useState(0);
  const [a2, setA2] = useState(0);
  const [a3, setA3] = useState(0);
  const [a4, setA4] = useState(0);
  const [g1, setG1] = useState('AND');
  const [g2, setG2] = useState('AND');
  const [g3, setG3] = useState('AND'); // 랜덤 고정 게이트
  const [pathChoice, setPathChoice] = useState(null); // {from: pos, options: [{to: pos, path: 'outer'|'diagonal'}]}
  const [gameOver, setGameOver] = useState(false);
  const [movePending, setMovePending] = useState(null); // {team:'red'|'blue', index:number, remaining:number}
  const [flashToken, setFlashToken] = useState(null); // {team:'red'|'blue', idx:number, type:'move'|'capture'}

  // 게이트 함수 및 출력 계산
  const gateFunctions = {
    AND: (a, b) => a & b,
    OR: (a, b) => a | b,
    XOR: (a, b) => a ^ b,
  };
  const { b1, b2, b3, steps } = useMemo(() => {
    const b1 = gateFunctions[g1](a1, a2);
    const b2 = gateFunctions[g2](a3, a4);
    const b3 = gateFunctions[g3](b1, b2);
    const steps = b1 * 4 + b2 * 2 + b3 * 1;
    return { b1, b2, b3, steps };
  }, [g1, g2, g3, a1, a2, a3, a4]);

  // 타이머
  useEffect(() => {
    if (view === 'game' && timer > 0 && !gameOver) {
      const interval = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    } else if (view === 'game' && timer === 0 && !gameOver) {
      // 시간 초과: 분기 대기 중이면 기본 옵션으로 자동 이동 확정, 아니면 턴 전환
      if (pathChoice && pathChoice.options && pathChoice.options.length && pathChoice.team === currentTurn) {
        const { options, steps: s, index: sel, team } = pathChoice;
        setPathChoice(null);
        finalizeMove(options[0].to, sel, team, s);
      } else {
        setCurrentTurn(currentTurn === 'red' ? 'blue' : 'red');
        generateInputs();
        setTimer(20);
      }
    }
  }, [timer, gameOver, view, pathChoice, currentTurn]);
  
  // 랜덤 입력 생성 (a1-a4 랜덤, g3 랜덤 고정)
  const generateInputs = () => {
    setA1(Math.floor(Math.random() * 2));
    setA2(Math.floor(Math.random() * 2));
    setA3(Math.floor(Math.random() * 2));
    setA4(Math.floor(Math.random() * 2));
    const gates = ['AND', 'OR', 'XOR'];
    setG3(gates[Math.floor(Math.random() * 3)]);
  };

  // 게이트 토글 (각각 독립)
  const toggleGate = useCallback((gate) => {
    const nextGates = { AND: 'OR', OR: 'XOR', XOR: 'AND' };
    if (gate === 1) {
      setG1(nextGates[g1]);
    } else if (gate === 2) {
      setG2(nextGates[g2]);
    }
  }, [g1, g2]);

  // 보드 그래프 정의
  const CENTER = 100;
  const DA_START = 200; // 대각선 A: O0 <-> CENTER <-> O10
  const DB_START = 210; // 대각선 B: O5 <-> CENTER <-> O15
  const isCorner = (n) => n === 0 || n === 5 || n === 10 || n === 15;
  const isCenter = (n) => n === CENTER;
  const isOuter = (n) => n >= 0 && n <= 19;
  const isDiagA = (n) => n >= 200 && n <= 207;
  const isDiagB = (n) => n >= 210 && n <= 217;

  const nextOuter = (n) => ((n + 1) % 20);
  const nextDiagA = (n) => {
    if (n >= 200 && n < 207) return n + 1; // A1..A7 -> 다음
    if (n === 207) return 10; // A8 -> O10
    return n; // 기타는 그대로 (호출되지 않도록)
  };
  const nextDiagB = (n) => {
    if (n >= 210 && n < 217) return n + 1; // B1..B7 -> 다음
    if (n === 217) return 15; // B8 -> O15
    return n;
  };

  // 한 칸 전진(경로 고정: 직선 구간에서는 자동 진행)
  const stepForwardFrom = (pos) => {
    if (isOuter(pos)) return nextOuter(pos);
    if (isDiagA(pos)) return nextDiagA(pos);
    if (isDiagB(pos)) return nextDiagB(pos);
    // center에서의 자동 진행은 없음 (반드시 선택 필요)
    return pos;
  };

  // 선택한 경로에 따라 s칸 후 최종 도착 노드 계산
  const firstStepByChoice = (pos, label) => {
    if (pos === 0) {
      // 시작 코너는 외곽만 허용
      return nextOuter(pos);
    }
    if (pos === 5) return label === '외곽' ? nextOuter(pos) : DB_START;
    if (pos === 10) return label === '외곽' ? nextOuter(pos) : 207;
    if (pos === 15) return label === '외곽' ? nextOuter(pos) : 217;
    if (pos === CENTER) {
      // 중앙은 대각만 허용 (A/B)
      return label === '대각A' ? 205 : 215;
    }
    return stepForwardFrom(pos);
  };

  const simulateFinal = (start, s, label) => {
    if (s <= 0) return start;
    let cur = firstStepByChoice(start, label);
    let remain = s - 1;
    while (remain > 0) {
      cur = stepForwardFrom(cur);
      remain -= 1;
    }
    return cur;
  };

  // 분기점에서 선택 가능한 최종 도착지 옵션 반환
  const getBranchFinalOptions = (pos, s) => {
    if (!isCorner(pos) && !isCenter(pos)) return null;
    const opts = [];
    if (pos === 0) {
      // 시작 코너: 외곽만
      const to = simulateFinal(pos, s, '외곽');
      opts.push({ to, label: '외곽' });
    } else if (pos === 5) {
      opts.push({ to: simulateFinal(pos, s, '외곽'), label: '외곽' });
      opts.push({ to: simulateFinal(pos, s, '대각'), label: '대각' });
    } else if (pos === 10) {
      opts.push({ to: simulateFinal(pos, s, '외곽'), label: '외곽' });
      opts.push({ to: simulateFinal(pos, s, '대각'), label: '대각' });
    } else if (pos === 15) {
      opts.push({ to: simulateFinal(pos, s, '외곽'), label: '외곽' });
      opts.push({ to: simulateFinal(pos, s, '대각'), label: '대각' });
    } else if (pos === CENTER) {
      opts.push({ to: simulateFinal(pos, s, '대각A'), label: '대각A' });
      opts.push({ to: simulateFinal(pos, s, '대각B'), label: '대각B' });
    }
    return opts.length ? opts : null;
  };

  // 경로 선택 시: 즉시 한 칸 진행 후 남은 이동 이어감
  const handlePathSelect = (option) => {
    if (!pathChoice) return;
    const { steps: s, index: sel, team } = pathChoice;
    setPathChoice(null);
    finalizeMove(option.to, sel, team, s);
  };

  // 현재 턴의 선택 인덱스/토큰 세터
  const getActiveSelected = () => (currentTurn === 'red' ? selectedRed : selectedBlue);
  const setActiveSelected = (idx) => (currentTurn === 'red' ? setSelectedRed(idx) : setSelectedBlue(idx));
  const getActiveTokens = () => (currentTurn === 'red' ? tokensRed : tokensBlue);
  const setActiveTokens = (arr) => (currentTurn === 'red' ? setTokensRed(arr) : setTokensBlue(arr));
  const getOpponentTokens = () => (currentTurn === 'red' ? tokensBlue : tokensRed);
  const setOpponentTokens = (arr) => (currentTurn === 'red' ? setTokensBlue(arr) : setTokensRed(arr));

  const nextSelectableIndex = () => {
    const tks = getActiveTokens();
    const start = getActiveSelected();
    for (let i = 1; i <= 3; i++) {
      const ni = (start + i) % 3;
      if (!tks[ni].finished) return ni;
    }
    return start;
  };

  // 락 & 이동
  const handleLockMove = () => {
    if (view !== 'game' || gameOver) return;
    // 분기 선택 대기 중이면 기본(첫 번째) 옵션으로 확정
    if (pathChoice && pathChoice.options && pathChoice.options.length) {
      const { options, steps: s, index: sel, team } = pathChoice;
      setPathChoice(null);
      finalizeMove(options[0].to, sel, team, s);
      return;
    }
    const tks = [...getActiveTokens()];
    let sel = getActiveSelected();
    if (tks[sel].finished) sel = nextSelectableIndex();
    const s = steps; // 0~7
    if (s === 0) {
      setCurrentTurn(currentTurn === 'red' ? 'blue' : 'red');
      generateInputs();
      setTimer(20);
      return;
    }
    const pos = tks[sel].pos;
    const branchOptions = getBranchFinalOptions(pos, s);
    if (branchOptions) {
      setPathChoice({ from: pos, options: branchOptions, steps: s, index: sel, team: currentTurn });
      return;
    }
    // 분기 아님: 외곽 고정으로 s칸 진행
    let cur = pos;
    for (let i = 0; i < s; i++) cur = stepForwardFrom(cur);
    finalizeMove(cur, sel, currentTurn, s);
  };

  // 최종 도착지로 즉시 이동하여 턴/캡처/완주 처리
  const finalizeMove = (toNode, selIndex, team, s) => {
    const teamActive = (team === 'red');
    const getT = teamActive ? tokensRed : tokensBlue;
    const setT = teamActive ? setTokensRed : setTokensBlue;
    const oppGet = teamActive ? tokensBlue : tokensRed;
    const oppSet = teamActive ? setTokensBlue : setTokensRed;
    const arr = [...getT];
    arr[selIndex] = { ...arr[selIndex], pos: toNode, dist: (arr[selIndex].dist || 0) + s };
    arr[selIndex].stack.forEach(si => {
      arr[si] = { ...arr[si], pos: toNode, dist: (arr[si].dist || 0) + s };
    });
    setT(arr);

    // 완주 판정(통과 인정)
    let finishedNow = false;
    const doneArr = [...arr];
    const d = (doneArr[selIndex].dist || 0);
    if (d >= 20) {
      doneArr[selIndex] = { ...doneArr[selIndex], finished: true };
      finishedNow = true;
    }
    setT(doneArr);

    // 캡처(최종 위치)
    let captured = false;
    const finalPos = doneArr[selIndex].pos;
    const oppArr = [...oppGet];
    for (let i = 0; i < 3; i++) {
      if (!oppArr[i].finished && oppArr[i].pos === finalPos) {
        oppArr[i] = { ...oppArr[i], pos: 0, finished: false, stack: [], dist: 0 };
        captured = true;
      }
    }
    oppSet(oppArr);

    // 승리 체크
    const meAll = teamActive ? doneArr : getActiveTokens();
    const finishedCount = meAll.filter(x => x.finished).length;
    if (finishedCount >= 3) {
      setGameOver(true);
      return;
    }

    // 턴/입력/타이머 + 애니메이션 트리거
    if (captured && !finishedNow) {
      setFlashToken({ team, idx: selIndex, type: 'capture' });
      setTimeout(() => setFlashToken(null), 500);
      generateInputs();
      setTimer(20);
    } else {
      setFlashToken({ team, idx: selIndex, type: 'move' });
      setTimeout(() => setFlashToken(null), 450);
      setCurrentTurn(teamActive ? 'blue' : 'red');
      generateInputs();
      setTimer(20);
    }
  };

  // 새 게임
  const handleNewGame = () => {
    setView('game');
    setCurrentTurn('red');
    setTimer(20);
    setTokensRed([{pos:0,finished:false,stack:[]},{pos:0,finished:false,stack:[]},{pos:0,finished:false,stack:[]}]);
    setTokensBlue([{pos:0,finished:false,stack:[]},{pos:0,finished:false,stack:[]},{pos:0,finished:false,stack:[]}]);
    setSelectedRed(0);
    setSelectedBlue(0);
    setA1(0); setA2(0); setA3(0); setA4(0);
    setG1('AND'); setG2('AND'); setG3('AND');
    setPathChoice(null);
    setGameOver(false);
    generateInputs();
  };

  // 노드 위치 계산 (외곽 20노드 + 중앙)
  // 시작점: 4사분면(우하단 코너), 진행 방향: 반시계 방향
  const getNodePosition = (node) => {
    if (node === 100) {
      return { x: 150, y: 150 };
    }
    // 대각선 A: O0(250,250) -> CENTER(150,150) -> O10(50,50)
    if (node >= 200 && node <= 207) {
      const points = [];
      // 0->center 4개
      for (let k = 1; k <= 4; k++) {
        const t = k / 5; // 0.2,0.4,0.6,0.8
        const x = 250 + (150 - 250) * t;
        const y = 250 + (150 - 250) * t;
        points.push({ x, y });
      }
      // center->10 4개
      for (let k = 1; k <= 4; k++) {
        const t = k / 5; // 0.2..0.8
        const x = 150 + (50 - 150) * t;
        const y = 150 + (50 - 150) * t;
        points.push({ x, y });
      }
      const idx = node - 200;
      return points[idx];
    }
    // 대각선 B: O5(250,50) -> CENTER(150,150) -> O15(50,250)
    if (node >= 210 && node <= 217) {
      const points = [];
      // 5->center 4개
      for (let k = 1; k <= 4; k++) {
        const t = k / 5;
        const x = 250 + (150 - 250) * t;
        const y = 50 + (150 - 50) * t;
        points.push({ x, y });
      }
      // center->15 4개
      for (let k = 1; k <= 4; k++) {
        const t = k / 5;
        const x = 150 + (50 - 150) * t;
        const y = 150 + (250 - 150) * t;
        points.push({ x, y });
      }
      const idx = node - 210;
      return points[idx];
    }
    const size = 300;
    const margin = 50;
    const innerSize = size - 2 * margin;
    const step = innerSize / 5; // 코너 사이 5칸
    let x, y;
    const i = ((node % 20) + 20) % 20;
    if (i < 5) {
      // 우측 변: 우하단(0) -> 우상단(5)
      x = size - margin;
      y = size - margin - i * step;
    } else if (i < 10) {
      // 상단 변: 우상단(5) -> 좌상단(10)
      x = size - margin - (i - 5) * step;
      y = margin;
    } else if (i < 15) {
      // 좌측 변: 좌상단(10) -> 좌하단(15)
      x = margin;
      y = margin + (i - 10) * step;
    } else {
      // 하단 변: 좌하단(15) -> 우하단(20)
      x = margin + (i - 15) * step;
      y = size - margin;
    }
    return { x, y };
  };

  // 토큰 렌더링 (3개씩, 선택 토큰 강조, stack 표시)
  const renderTokens = () => {
    const out = [];
    const all = [
      ...tokensRed.map((t, i) => ({ team: 'red', idx: i, ...t })),
      ...tokensBlue.map((t, i) => ({ team: 'blue', idx: i, ...t })),
    ];
    // 노드별 그룹핑으로 겹침 보정
    const groups = new Map();
    for (const tok of all) {
      if (tok.finished) continue;
      const key = tok.pos;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(tok);
    }
    const offsets = [ {dx:-6,dy:6}, {dx:6,dy:-6}, {dx:0,dy:0}, {dx:-12,dy:12}, {dx:12,dy:-12} ];
    groups.forEach((arr, key) => {
      const base = getNodePosition(key);
      arr.forEach((tok, j) => {
        const off = offsets[j] || {dx:0,dy:0};
        const isSelected = tok.team === 'red' ? (currentTurn==='red' && selectedRed===tok.idx) : (currentTurn==='blue' && selectedBlue===tok.idx);
        const stackCount = tok.stack.length + 1; // 자신 포함
        out.push(
          <g key={`${tok.team}-${tok.idx}`}>
            {/* 확대 터치 영역 */}
            <circle cx={base.x + off.dx} cy={base.y + off.dy} r="16" fill="transparent" pointerEvents="all" onClick={() => {
              if (tok.team === 'red' && currentTurn==='red') {
                setSelectedRed(tok.idx);
                // 업기: 같은 위치 다른 말 stack에 추가
                const tks = [...tokensRed];
                tks[tok.idx].stack = [];
                for (let k = 0; k < 3; k++) {
                  if (k !== tok.idx && tks[k].pos === tok.pos && !tks[k].finished) {
                    tks[tok.idx].stack.push(k);
                  }
                }
                setTokensRed(tks);
              }
              if (tok.team === 'blue' && currentTurn==='blue') {
                setSelectedBlue(tok.idx);
                const tks = [...tokensBlue];
                tks[tok.idx].stack = [];
                for (let k = 0; k < 3; k++) {
                  if (k !== tok.idx && tks[k].pos === tok.pos && !tks[k].finished) {
                    tks[tok.idx].stack.push(k);
                  }
                }
                setTokensBlue(tks);
              }
            }} />
            {/* 실제 토큰 비주얼 */}
            <circle cx={base.x + off.dx} cy={base.y + off.dy} r="8" className={`token ${tok.team} ${isSelected ? 'selected' : ''} ${flashToken && flashToken.team===tok.team && flashToken.idx===tok.idx ? (flashToken.type==='capture' ? 'captured' : 'moved') : ''}`} />
            {stackCount > 1 && <text x={base.x + off.dx} y={base.y + off.dy + 3} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">{stackCount}</text>}
            <text x={base.x + off.dx} y={base.y + off.dy - 12} textAnchor="middle" fill={tok.team === 'red' ? '#ff3b3b' : '#2bb1ff'} fontSize="10" fontWeight="bold">{tok.pos}</text>
          </g>
        );
      });
    });
    return out;
  };

  // 메뉴/설명 화면
  if (view !== 'game') {
    return (
      <div className="app">
        {view === 'menu' && (
          <div className="center-stage">
            <section className="card" style={{textAlign:'center'}}>
              <h2 style={{fontFamily:'Orbitron, sans-serif', fontWeight:900, letterSpacing:'1px'}}>2bit Yootnori</h2>
              <p style={{color:'#a8afff'}}>Logic Gate Powered · 2P Pass & Play</p>
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                <button className="btn primary" onClick={handleNewGame}>게임 시작</button>
                <button className="btn" onClick={() => setView('howto')}>플레이 방법</button>
              </div>
            </section>
          </div>
        )}
        {view === 'howto' && (
          <section className="card">
            <h3>플레이 방법</h3>
            <p>이 게임은 윷 던지기 대신 논리게이트로 이동 칸 수를 만드는 윷놀이 변형입니다. 한 기기에서 두 명이 번갈아 플레이합니다.</p>

            <h4 style={{marginTop:12}}>맵(말판) 기본 구조</h4>
            <ul style={{margin:'6px 0 10px 18px'}}>
              <li><b>노드</b>: 총 29칸(외곽 20 + 대각 내부 8 + 중앙 1). 분기점은 <b>네 모서리 + 중앙</b>.</li>
              <li><b>이동 방향</b>: 기본은 반시계 방향.</li>
              <li><b>가능한 코스</b>: 외곽만, 대각선 1회 포함, 모서리→중앙→반대 모서리(최단 코스).</li>
            </ul>

            <h4>말 이동 규칙(분기/지름길)</h4>
            <ul style={{margin:'6px 0 10px 18px'}}>
              <li><b>기본 진행</b>: 시작은 보드 밖 → 첫 이동으로 시작 코너 진입 → 외곽을 따라 전진.</li>
              <li><b>직진 원칙</b>: 분기점이 <b>아닌 칸</b>에서는 선택 없이 다음 칸으로만 전진.</li>
              <li><b>분기 진입</b>: <b>모서리/중앙</b>에 <b>정확히 도착</b>했을 때만 대각선으로 꺾을 수 있음. 지나치거나 다른 칸에서 진입 불가.</li>
              <li><b>중앙 규칙</b>: 중앙에 도달하면 대각선으로 반대 모서리 방향으로 진행(또는 외곽 코스로 복귀 선택).</li>
              <li><b>경로 고정</b>: 분기점에서 출발하면 <b>다음 분기점까지</b>는 그 경로로 고정. 업기(스택) 상태면 <b>공통으로 갈 수 있는 경로</b>만 합법.</li>
            </ul>

            <h4>상호작용</h4>
            <ul style={{margin:'6px 0 10px 18px'}}>
              <li><b>업기</b>: 같은 팀이 같은 칸에 서면 합쳐져 함께 이동.</li>
              <li><b>잡기</b>: 상대 말이 있는 칸에 정확히 도착하면 그 말(스택 포함) 전부 시작으로. <b>중앙도 잡기 가능</b>. 잡으면 한 번 더.</li>
            </ul>

            <h4>완주 판정</h4>
            <ul style={{margin:'6px 0 10px 18px'}}>
              <li>본 게임은 <b>통과 인정</b> 정책을 사용합니다(누적 20칸 이상 이동 시 완주).</li>
            </ul>

            <h4>게이트로 이동 칸 만들기</h4>
            <ul style={{margin:'6px 0 10px 18px'}}>
              <li>턴마다 입력 a1,a2,a3,a4(0/1)가 랜덤.</li>
              <li>G1/G2는 AND/OR/XOR 중 선택(게이트 탭/클릭). G3는 랜덤 고정.</li>
              <li>이동칸 = b1*4 + b2*2 + b3 (b1=G1(a1,a2), b2=G2(a3,a4), b3=G3(b1,b2)).</li>
            </ul>

            <p style={{color:'#a8afff'}}>팁: 경로 선택 창이 떠 있을 때 다시 "이동"을 누르면 기본 경로(외곽)로 확정됩니다. 각 턴 제한 시간은 20초입니다.</p>
            <div style={{display:'flex', gap:8}}>
              <button className="btn" onClick={() => setView('menu')}>메뉴로</button>
              <button className="btn primary" onClick={handleNewGame}>바로 시작</button>
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      {/* HUD */}
      <div className="hud-top">
        <div className="hud-left">
          <span className={`dot ${currentTurn}`}></span>
          {currentTurn === 'red' ? '빨강' : '파랑'} 턴
        </div>
        <div className="hud-right">
          <span className={`timer-num ${timer <= 5 ? 'danger' : ''}`}>{timer}s</span>
          <button className="btn" style={{marginLeft:8}} onClick={() => setView('menu')}>메뉴</button>
        </div>
      </div>

      {/* 논리 게이트 시각화 */}
      <section className="logic-row card">
        <svg className="logic-diagram" viewBox="0 0 400 160" width="100%" height="160">
          {/* 입력 박스 a1,a2,a3,a4 */}
          <rect x="10" y="10" width="40" height="20" rx="4" fill="#1f2340" stroke="#2c3059" />
          <rect x="10" y="40" width="40" height="20" rx="4" fill="#1f2340" stroke="#2c3059" />
          <rect x="10" y="100" width="40" height="20" rx="4" fill="#1f2340" stroke="#2c3059" />
          <rect x="10" y="130" width="40" height="20" rx="4" fill="#1f2340" stroke="#2c3059" />
          <text x="30" y="25" textAnchor="middle" fill="#e6e8ff" fontSize="12">a1={a1}</text>
          <text x="30" y="55" textAnchor="middle" fill="#e6e8ff" fontSize="12">a2={a2}</text>
          <text x="30" y="115" textAnchor="middle" fill="#e6e8ff" fontSize="12">a3={a3}</text>
          <text x="30" y="145" textAnchor="middle" fill="#e6e8ff" fontSize="12">a4={a4}</text>
          {/* G1 게이트 */}
          <g onClick={() => toggleGate(1)} onTouchStart={() => toggleGate(1)} style={{cursor: 'pointer'}}>
            <rect x="80" y="15" width="60" height="40" rx="6" fill="#252a52" stroke="#2c3059" />
            <text x="110" y="40" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">{g1}</text>
          </g>
          {/* 연결선 a1,a2 -> G1 */}
          <line x1="50" y1="20" x2="80" y2="35" stroke="#9aa3ff" strokeWidth="2" />
          <line x1="50" y1="50" x2="80" y2="35" stroke="#9aa3ff" strokeWidth="2" />
          {/* b1 출력 */}
          <rect x="160" y="25" width="40" height="20" rx="4" fill="#1f2340" stroke="#2c3059" />
          <text x="180" y="40" textAnchor="middle" fill="#e6e8ff" fontSize="12">b1={b1}</text>
          <line x1="140" y1="35" x2="160" y2="35" stroke="#9aa3ff" strokeWidth="2" />
          {/* G2 게이트 */}
          <g onClick={() => toggleGate(2)} onTouchStart={() => toggleGate(2)} style={{cursor: 'pointer'}}>
            <rect x="80" y="105" width="60" height="40" rx="6" fill="#252a52" stroke="#2c3059" />
            <text x="110" y="130" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">{g2}</text>
          </g>
          {/* 연결선 a3,a4 -> G2 */}
          <line x1="50" y1="110" x2="80" y2="125" stroke="#9aa3ff" strokeWidth="2" />
          <line x1="50" y1="140" x2="80" y2="125" stroke="#9aa3ff" strokeWidth="2" />
          {/* b2 출력 */}
          <rect x="160" y="115" width="40" height="20" rx="4" fill="#1f2340" stroke="#2c3059" />
          <text x="180" y="130" textAnchor="middle" fill="#e6e8ff" fontSize="12">b2={b2}</text>
          <line x1="140" y1="125" x2="160" y2="125" stroke="#9aa3ff" strokeWidth="2" />
          {/* G3 게이트 (랜덤 고정) */}
          <rect x="240" y="65" width="60" height="40" rx="6" fill="#252a52" stroke="#2c3059" />
          <text x="270" y="90" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">{g3}</text>
          {/* 연결선 b1,b2 -> G3 */}
          <line x1="200" y1="35" x2="240" y2="85" stroke="#9aa3ff" strokeWidth="2" />
          <line x1="200" y1="125" x2="240" y2="85" stroke="#9aa3ff" strokeWidth="2" />
          {/* b3 출력 */}
          <rect x="320" y="75" width="40" height="20" rx="4" fill="#1f2340" stroke="#2c3059" />
          <text x="340" y="90" textAnchor="middle" fill="#e6e8ff" fontSize="12">b3={b3}</text>
          <line x1="300" y1="85" x2="320" y2="85" stroke="#9aa3ff" strokeWidth="2" />
          {/* steps */}
          <text x="370" y="90" textAnchor="start" fill="#e6e8ff" fontSize="12">steps={steps}</text>
        </svg>
      </section>

      {/* 보드 + 사이드 컨트롤 (가로 배치) */}
      <section className="board-row">
        <div className="board card">
          <svg id="yut-board" width="380" height="380" viewBox="0 0 300 300">
          {/* 배경 */}
          <rect x="0" y="0" width="300" height="300" fill="#0b0f24" rx="12" />
          {/* 외곽 경로 */}
          <rect x="50" y="50" width="200" height="200" rx="8" fill="none" stroke="#3850ff" strokeOpacity="0.65" strokeWidth="3" />
          {/* 대각선 */}
          <line x1="50" y1="50" x2="250" y2="250" stroke="#7aa3ff" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="4 4" />
          <line x1="250" y1="50" x2="50" y2="250" stroke="#7aa3ff" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="4 4" />
          {/* 중앙 노드 */}
          <circle cx="150" cy="150" r="6" fill="#9cc6ff" opacity="0.9" />
          {/* 코너 및 분기점 강조 */}
          <circle cx="250" cy="250" r="5" fill="#9cc6ff" opacity="0.9" />
          <circle cx="50" cy="50" r="5" fill="#9cc6ff" opacity="0.9" />
          {/* 외곽 20 노드 */}
          {Array.from({ length: 20 }, (_, i) => {
            const pos = getNodePosition(i);
            return <circle key={`o-${i}`} cx={pos.x} cy={pos.y} r="4" fill="#cfe3ff" opacity="0.7" />;
          })}
          {/* 대각선 A 8 노드 */}
          {Array.from({ length: 8 }, (_, i) => {
            const nid = 200 + i;
            const pos = getNodePosition(nid);
            return <circle key={`a-${i}`} cx={pos.x} cy={pos.y} r="3.5" fill="#8fb5ff" opacity="0.5" />;
          })}
          {/* 대각선 B 8 노드 */}
          {Array.from({ length: 8 }, (_, i) => {
            const nid = 210 + i;
            const pos = getNodePosition(nid);
            return <circle key={`b-${i}`} cx={pos.x} cy={pos.y} r="3.5" fill="#8fb5ff" opacity="0.5" />;
          })}
          {/* 시작점(우하단) & 진행 방향(반시계) */}
          <polygon points="260,260 250,250 260,240" fill="#ff3b3b" />
          <text x="250" y="275" textAnchor="middle" fontSize="12" fill="#222">시작</text>
          {/* 방향 화살표 */}
          <polygon points="260,220 270,210 260,200" fill="#666" />
          <polygon points="220,40 210,30 200,40" fill="#666" />
          <polygon points="40,80 30,90 40,100" fill="#666" />
          {/* 토큰 */}
          {renderTokens()}
          {/* 경로 선택 */}
          {pathChoice && pathChoice.options.map((opt, i) => {
            const pos = getNodePosition(opt.to);
            return (
              <g key={`path-${i}`}>
                {/* 확대 터치 영역 */}
                <circle cx={pos.x} cy={pos.y} r="24" fill="transparent" pointerEvents="all" onClick={() => handlePathSelect(opt)} onTouchStart={() => handlePathSelect(opt)} />
                {/* 선택 지점 시각 */}
                <circle cx={pos.x} cy={pos.y} r="11" fill="#00d1ff" stroke="#fff" strokeWidth="2" cursor="pointer" onClick={() => handlePathSelect(opt)} onTouchStart={() => handlePathSelect(opt)} />
                <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">{opt.label}</text>
              </g>
            );
          })}
          </svg>
        </div>
      </section>

      {gameOver && (
        <div className="overlay">
          <div className="dialog">
            <h2>게임 종료</h2>
            <p>{currentTurn === 'red' ? '빨강' : '파랑'} 팀 승리!</p>
            <button className="btn primary" onClick={() => setView('menu')}>메뉴로</button>
          </div>
        </div>
      )}

      {/* 하단 컨트롤: 이동/말 바꾸기 */}
      <div className="controls" style={{display:'flex', gap:8}}>
        <button className="btn primary full" onClick={handleLockMove}>🔒 이동</button>
        <button className="btn full" onClick={() => setActiveSelected(nextSelectableIndex())}>↺ 말 바꾸기</button>
      </div>
    </div>
  );
}

export default App;
