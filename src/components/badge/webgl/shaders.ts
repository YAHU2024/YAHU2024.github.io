// 徽章 WebGL 着色器（裸 WebGL1 / GLSL ES 1.00）
// 坐标约定与 CSS 3D 完全一致：x 右、y 下、z 朝观众；
// 透视用 CSS perspective 的等价手写除法 x·d/(d-z)，d 对齐 .cat-stage 的 1000px。
// 旋转矩阵 = Rx·Ry（列向量先 Ry 后 Rx），与覆盖层
// `transform: rotateX(rx) rotateY(ry) translateZ(z) scale(s)` 的矩阵序一致。

export const VERT = `
attribute vec3 a_pos;
uniform mat3 u_rot;    // Rx·Ry（column-major）
uniform float u_radius; // xy 半径缩放（css px）
uniform float u_z;      // 本面片局部 z 偏移（css px，随旋转一起变换）
uniform float u_d;      // 透视距离（= .cat-stage perspective 1000px）
uniform float u_half;   // 画布 css 半宽（含出界余量）
varying vec2 v_p;       // 单位圆盘局部坐标 [-1,1]
varying vec2 v_w;       // 旋转后世界坐标（观察者对齐）——背面纹理滚动采样用

void main() {
  vec3 world = u_rot * vec3(a_pos.xy * u_radius, u_z);
  float w = u_d - world.z;
  vec2 clip = world.xy * (u_d / w) / u_half;
  v_p = a_pos.xy;
  v_w = world.xy / u_radius;
  gl_Position = vec4(clip, 0.0, 1.0);
}
`

// u_mode: 0 = 侧壁层（纯色） / 1 = 正面（碗内贴猫脸纹理） / 2 = 背面（头像碗）
export const FRAG = `
precision mediump float;
varying vec2 v_p;
varying vec2 v_w;
uniform float u_mode;
uniform vec4 u_color;   // 侧壁层色
uniform vec4 u_base;    // 面底色 --face-base
uniform vec4 u_hi;      // 径向高光 --badge-hi
uniform vec2 u_hiC;     // 高光中心（正面 30%/22% → (-0.4,-0.56)；背面镜像）
uniform vec4 u_border;  // 1px 描边 --gborder
uniform vec4 u_glowIn;  // inset 高光环 --glow-inner
uniform vec4 u_accent;  // 26px 导光辉 --accent-soft
uniform vec4 u_inset;   // 30px 玻璃导光 --badge-inset
uniform float u_px;     // 1 css px 的局部单位长度
uniform float u_bowl;   // 头像碗半径（局部单位）
uniform sampler2D u_tex;     // unit0：背面头像
uniform sampler2D u_faceTex; // unit1：正面猫脸中性帧
uniform sampler2D u_earTex;  // unit2：耳朵抖动变体帧（±4° 绕耳根）
uniform float u_closed;      // 眨眼/眯眼因子 0(睁)~1(闭)
uniform vec2 u_gazeL;        // 左眼视线偏移（局部单位，屏幕方向 x 右/y 下正）
uniform vec2 u_gazeR;        // 右眼视线偏移（每眼独立 → 双眼汇聚指向鼠标，同旧版）
uniform float u_earBlend;    // 耳朵帧混合 0(中性)~1(变体)
uniform float u_pupilBlend;  // 瞳孔放大因子 0(中性)~1(放大 1.14×，程序化半径缩放)
uniform float u_faceRot;     // 头部微倾（弧度，正 = 屏幕顺时针）
uniform vec2 u_faceTilt;     // 头部微倾平移（SVG 单位，屏幕方向 x 右/y 下正）
uniform vec3 u_fur;          // 眼睑色（palette.fur）
uniform vec3 u_furEdge;      // 眼睑缘色（palette.furEdge）
uniform vec3 u_pupilCol;     // 瞳孔色（palette.pupil）

// straight-alpha over 合成
vec4 over(vec4 top, vec4 bot) {
  float a = top.a + bot.a * (1.0 - top.a);
  vec3 c = (top.rgb * top.a + bot.rgb * bot.a * (1.0 - top.a)) / max(a, 0.0001);
  return vec4(c, a);
}

// 抗锯齿带（smoothstep 羽化代替 step 硬边；f ≈ 1.2 SVG 单位）
float band(float a, float b, float x, float f) {
  return smoothstep(a - f, a + f, x) * (1.0 - smoothstep(b - f, b + f, x));
}

void main() {
  if (u_mode < 0.5) {
    gl_FragColor = vec4(u_color.rgb * u_color.a, u_color.a);
    return;
  }

  float r = length(v_p);
  float edgeAA = 1.0 - smoothstep(1.0 - u_px, 1.0, r);

  // 正面猫脸碗：碗内贴猫脸静帧纹理（焊在面片上 → 与徽章绝对融合）。
  // 坐标系实证：本管线按 GL 惯例渲染（v_p.y=+1 在屏幕上方；纹理不翻转 uv.y=0 为图首行），
  // 故直立贴图 = uv.x 随 v_p.x 同向、uv.y 与 v_p.y 反向 —— 与背面碗已验证公式
  // uv = 0.5 - v_w/(2·bowl)（背面静止时 v_w=(-x,y)，展开即同款）完全一致。
  // 眼睑为程序化矩形（坐标对齐 CAT_GEO：眼 cx74/126、cy108、ry19、睑高20，
  // svg 200 单位 ↔ v_p ∈ [-bowl, bowl]），u_closed 驱动上下睑合拢；
  // 头部微倾（u_faceRot/u_faceTilt）与视线（u_gazeL/u_gazeR）在内容坐标前合成。
  if (u_mode < 1.5 && r < u_bowl) {
    float invB = 1.0 / u_bowl;
    // 头部微倾平移（SVG 单位 → 局部；屏幕 y 下正 → 局部 y 上正取反）
    vec2 q = v_p - u_faceTilt * (u_bowl * 0.01) * vec2(1.0, -1.0);
    // 头部微倾旋转：u_faceRot 正 = 屏幕顺时针（y 上系中取 M⁻¹ = [c,-s;s,c]）
    float cr = cos(u_faceRot), sr = sin(u_faceRot);
    q = vec2(q.x * cr - q.y * sr, q.x * sr + q.y * cr);
    // SVG 内容坐标（200×200，y 向下）；纹理不翻转：uv = c/200。
    // 纹理完全静止采样：眼白是径向渐变（scleraHi→sclera→scleraDeep），任何采样
    // 偏移都会让渐变高光"游泳"= 整颗黄眼球在动。视线改为瞳孔组程序化绘制。
    vec2 c = vec2(q.x * invB * 100.0 + 100.0, 100.0 - q.y * invB * 100.0);
    vec2 uv = c * 0.005;
    vec2 s = c;
    vec4 t = texture2D(u_faceTex, uv);
    if (u_earBlend > 0.001) t = mix(t, texture2D(u_earTex, uv), clamp(u_earBlend, 0.0, 1.0));
    vec3 rgb = t.rgb;
    // ── 程序化瞳孔组（几何/配色对齐 CatEye：椭圆瞳 rx7.052/ry8.2、高光大
    // (-2.788,-3.444) r2.46 α.92、高光小 (+2.624,+2.46) r1.23 α.42）。
    // 只有黑眼珠（含高光）随 u_gazeL/R 平移 + u_pupilBlend 放大 1.14×，
    // 眼白渐变与眼眶描边纹丝不动 —— 与旧 SVG clipPath+translate 语义一致。
    vec2 eyeC = (s.x < 100.0) ? vec2(74.0, 108.0) : vec2(126.0, 108.0);
    vec2 gSvg = ((s.x < 100.0) ? u_gazeL : u_gazeR) * (invB * 100.0);
    float pk = 1.0 + 0.14 * clamp(u_pupilBlend, 0.0, 1.0);
    vec2 pc = eyeC + gSvg;
    float dp = length((s - pc) / (vec2(7.052, 8.2) * pk));
    float pupilA = 1.0 - smoothstep(0.975, 1.0, dp);
    rgb = mix(rgb, u_pupilCol, pupilA);
    float d1 = length((s - pc + vec2(2.788, 3.444) * pk) / (2.46 * pk));
    float s1 = (1.0 - smoothstep(0.92, 1.0, d1)) * 0.92;
    float d2 = length((s - pc - vec2(2.624, 2.46) * pk) / (1.23 * pk));
    float s2 = (1.0 - smoothstep(0.85, 1.0, d2)) * 0.42;
    rgb = mix(rgb, vec3(1.0), clamp(s1 + s2, 0.0, 1.0));
    // ── 眼睑（程序化矩形，坐标对齐 CAT_GEO / CatFace rect）：x ∈ [cx±18]，
    // 上睑 y ∈ [88+ty, 108+ty]、下睑 y ∈ [108+by, 128+by]（lidH = ry+1 = 20）。
    // 睑与睑线必须裁剪进眼椭圆（旧 SVG clipPath 语义）：否则睑色平涂盖掉
    // 眼眶描边/眼外头部高光、睑线伸出眼外 → 眨眼出现块状"像素感"。
    float ty = mix(-20.0, 0.0, u_closed);  // 上睑位移
    float by = mix(20.0, 0.0, u_closed);   // 下睑位移
    float f = 1.2;
    float lidGate = smoothstep(0.0, 0.02, u_closed);
    float lidTopY = band(88.0 + ty, 108.0 + ty, s.y, f);
    float lidBotY = band(108.0 + by, 128.0 + by, s.y, f);
    float inL = band(56.0, 92.0, s.x, f) * (lidTopY + lidBotY);
    float inR = band(108.0, 144.0, s.x, f) * (lidTopY + lidBotY);
    float de = length((s - eyeC) / vec2(17.0, 19.0));
    float clip = 1.0 - smoothstep(0.985, 1.015, de);
    float lid = clamp(inL + inR, 0.0, 1.0) * lidGate * clip;
    // 上睑底缘 furEdge 线（SVG rect: y ∈ [106.5, 109.5]，rx 1.5 圆角近似为羽化带）
    float edgeLine = band(106.5 + ty, 109.5 + ty, s.y, f)
      * (band(56.0, 92.0, s.x, f) + band(108.0, 144.0, s.x, f))
      * lidGate * clip;
    rgb = mix(rgb, u_fur, lid);
    rgb = mix(rgb, u_furEdge, clamp(edgeLine, 0.0, 1.0));
    float be = 1.0 - smoothstep(u_bowl - u_px, u_bowl, r);
    gl_FragColor = vec4(rgb * t.a * be, t.a * be);
    return;
  }

  // 背面头像碗：碗内贴纹理（含顶部内凹阴影近似），碗外走背面面片着色
  // uv 用世界坐标 v_w（观察者对齐）：翻转时采样窗口相对碗滑动——
  // 图像从侧面"滚进"碗内、随翻转继续滚过（用户指定的滚筒动态），
  // 任意翻转角度下图像无镜像；uv 取反 = 恒定旋转 180°（真机实测头像方向需倒转）
  if (u_mode > 1.5 && r < u_bowl) {
    vec2 uv = 0.5 - v_w / (2.0 * u_bowl);
    vec4 t = texture2D(u_tex, uv);
    float sh = (1.0 - smoothstep(-u_bowl, -u_bowl + 12.0 * u_px, v_p.y)) * 0.24;
    t.rgb *= 1.0 - sh;
    float be = 1.0 - smoothstep(u_bowl - u_px, u_bowl, r);
    gl_FragColor = vec4(t.rgb * t.a * be, t.a * be);
    return;
  }

  // 面片公共底：底色 + 径向高光（radial-gradient(120% 120% at x% 22%, hi, transparent 55%) 等价）
  float g = length((v_p - u_hiC) / 1.2);
  float ha = u_hi.a * (1.0 - smoothstep(0.0, 0.55, g));
  vec4 c = vec4(u_base.rgb, u_base.a); // BISECT: skip hi over

  if (u_mode < 1.5) {
    // 正面独有：1px 顶边高光线 + 4px inset 亮环（--glow-inner）+ 30px 玻璃导光
    float topLine = smoothstep(1.0 - 2.0 * u_px, 1.0 - 0.8 * u_px, r)
      * (1.0 - smoothstep(-0.9, -0.4, v_p.y));
    c = over(vec4(u_glowIn.rgb, u_glowIn.a * topLine), c);

    float ring4 = smoothstep(1.0 - 4.5 * u_px, 1.0 - 3.5 * u_px, r);
    c = over(vec4(u_glowIn.rgb, u_glowIn.a * ring4), c);

    float t30 = clamp((1.0 - r) / (30.0 * u_px), 0.0, 1.0);
    c = over(vec4(u_inset.rgb, u_inset.a * t30 * t30 * (3.0 - 2.0 * t30)), c);
  }

  // 公共：26px accent 导光辉（inset box-shadow blur 的近似平方衰减）
  float t26 = clamp((1.0 - r) / (26.0 * u_px), 0.0, 1.0);
  c = over(vec4(u_accent.rgb, u_accent.a * t26 * t26 * (3.0 - 2.0 * t26)), c);

  // 公共：1px 边缘描边（--gborder）
  float bd = smoothstep(1.0 - 1.5 * u_px, 1.0 - 0.5 * u_px, r);
  c = over(vec4(u_border.rgb, u_border.a * bd), c);

  c.a *= edgeAA;
  // 预乘输出：配 blendFuncSeparate(ONE, ONE_MINUS_SRC_ALPHA) 的 premultiplied 合成
  gl_FragColor = vec4(c.rgb * c.a, c.a);
}
`
