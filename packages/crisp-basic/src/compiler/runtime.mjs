// SPDX-License-Identifier: BSD-3-Clause
// Independent C99 support routines for generated programs, never a BASIC VM.
export default String.raw`
/* Original CrispBASIC compiled runtime, BSD-3-Clause. */
#ifdef CB_REAL_BINARY64
#define fabsl fabs
#define fmodl fmod
#define truncl trunc
#define floorl floor
#define powl pow
#define sqrtl sqrt
#define sinl sin
#define cosl cos
#define tanl tan
#define asinl asin
#define acosl acos
#define atanl atan
#define expl exp
#define logl log
#define log10l log10
#define strtold strtod
#endif
typedef struct cb_string { size_t references, length; unsigned char data[]; } cb_string;
typedef struct { int string; long double number; cb_string *text; int integer; int64_t whole; } cb_value;
typedef struct { int kind, defined; cb_value value; } cb_var;
typedef struct { int kind; size_t dimensions, count; size_t *bounds; cb_var *items; } cb_array;
typedef struct cb_scope_record {
    int array; void *address;
    union { cb_var scalar; cb_array vector; } saved;
    struct cb_scope_record *next;
} cb_scope_record;
static const long double cb_pi = 3.141592653589793238462643383279502884L;
static uint32_t cb_time_offset;
static unsigned int cb_column, cb_print_width;
static void cb_fail(const char *message) {
    fprintf(stderr, "BASIC line %lu: %s\n", cb_line, message);
    exit(1);
}
static void *cb_allocate(size_t bytes) {
    void *p = malloc(bytes ? bytes : 1);
    if (!p) cb_fail("out of memory");
    return p;
}
#if defined(CB_REAL_BINARY64) && (defined(__AVR__) || defined(CB_TEST_AVR_DECIMAL))
/* avr-libc's floating printf only supports binary32, even in a double64
 * multilib. This original formatter uses exact unsigned integer ratios and
 * rounds once, to nearest with ties to even. No floating approximation or
 * reduced-precision libc conversion enters nine-digit output. */
#define CB_EXACT_DECIMAL_FORMAT 1
#if defined(__WITH_LIBF7_LIBGCC__) || defined(CB_TEST_AVR_DECIMAL)
/* GCC's AVR libf7 has a weak double packer that rounds halfway cases up and
 * rounds before aligning subnormals. Supply original nearest-even packing at
 * that ABI boundary. The documented libf7 representation is flags, seven
 * little-endian significand bytes, then a little-endian signed exponent.
 * This code is original; no GCC implementation is incorporated. */
uint64_t __f7_get_double(const void *source) {
    const unsigned char *bytes = source;
    uint64_t significand = 0, fraction, remainder, halfway;
    uint64_t sign = (uint64_t)(bytes[0] & 1u) << 63;
    uint16_t stored = (uint16_t)bytes[8] | (uint16_t)bytes[9] << 8;
    int32_t exponent = stored > INT16_MAX ? (int32_t)stored - 65536L : stored;
    unsigned int shift;
    if (bytes[0] & 4u) return sign | UINT64_C(0x7ff8000000000000);
    if (bytes[0] & 128u) return sign | UINT64_C(0x7ff0000000000000);
    memcpy(&significand, bytes + 1, 7);
    if (!significand || exponent < -1075) return sign;
    if (exponent >= 1024) return sign | UINT64_C(0x7ff0000000000000);
    shift = exponent < -1022 ? (unsigned int)(-exponent - 1019) : 3;
    fraction = significand >> shift;
    halfway = UINT64_C(1) << (shift - 1);
    remainder = significand & ((halfway << 1) - 1);
    if (remainder > halfway || (remainder == halfway && (fraction & 1))) ++fraction;
    if (exponent < -1022) return sign | fraction;
    if (fraction == (UINT64_C(1) << 53)) { fraction >>= 1; ++exponent; }
    if (exponent >= 1024) return sign | UINT64_C(0x7ff0000000000000);
    return sign | (uint64_t)(exponent + 1023) << 52 | (fraction & UINT64_C(0xfffffffffffff));
}
#endif
typedef struct { uint32_t *word; size_t used, capacity; } cb_decimal_big;
static cb_decimal_big cb_decimal_new(size_t capacity) {
    cb_decimal_big value;
    if (capacity > SIZE_MAX / sizeof(uint32_t)) cb_fail("decimal conversion too large");
    value.word = cb_allocate(capacity * sizeof(uint32_t));
    memset(value.word, 0, capacity * sizeof(uint32_t));
    value.used = 0; value.capacity = capacity; return value;
}
static void cb_decimal_trim(cb_decimal_big *value) {
    while (value->used && !value->word[value->used - 1]) --value->used;
}
static void cb_decimal_set(cb_decimal_big *value, uint64_t number) {
    value->word[0] = (uint32_t)number; value->word[1] = (uint32_t)(number >> 32);
    value->used = 2; cb_decimal_trim(value);
}
static void cb_decimal_small(cb_decimal_big *value, uint32_t multiplier, uint32_t addend) {
    size_t i; uint32_t carry = addend;
    for (i = 0; i < value->used; ++i) {
        /* Decimal multiplication only needs a factor of ten. Two 16-bit
         * halves avoid expensive 64-bit arithmetic on an eight-bit AVR. */
        uint32_t low = (value->word[i] & 65535u) * multiplier + carry;
        uint32_t high = (value->word[i] >> 16) * multiplier + (low >> 16);
        value->word[i] = (low & 65535u) | (high << 16); carry = high >> 16;
    }
    if (carry) {
        if (value->used == value->capacity) cb_fail("decimal conversion too large");
        value->word[value->used++] = (uint32_t)carry;
    }
}
static void cb_decimal_left(cb_decimal_big *value, size_t shift) {
    size_t words = shift / 32, i; unsigned int bits = (unsigned int)(shift % 32);
    uint32_t carry = 0;
    if (!value->used || !shift) return;
    if (value->used + words + (bits != 0) > value->capacity) cb_fail("decimal conversion too large");
    memmove(value->word + words, value->word, value->used * sizeof(uint32_t));
    memset(value->word, 0, words * sizeof(uint32_t)); value->used += words;
    if (bits) {
        for (i = words; i < value->used; ++i) {
            uint32_t old = value->word[i];
            value->word[i] = (old << bits) | carry; carry = old >> (32 - bits);
        }
        if (carry) value->word[value->used++] = carry;
    }
}
static int cb_decimal_compare(const cb_decimal_big *a, const cb_decimal_big *b) {
    size_t i;
    if (a->used != b->used) return a->used > b->used ? 1 : -1;
    for (i = a->used; i-- > 0;) if (a->word[i] != b->word[i]) return a->word[i] > b->word[i] ? 1 : -1;
    return 0;
}
static void cb_decimal_subtract(cb_decimal_big *a, const cb_decimal_big *b) {
    size_t i; uint32_t borrow = 0;
    for (i = 0; i < a->used; ++i) {
        uint32_t old = a->word[i], part = i < b->used ? b->word[i] : 0;
        a->word[i] = old - part - borrow;
        borrow = old < part || (borrow && old == part);
    }
    cb_decimal_trim(a);
}
static size_t cb_decimal_format(char *buffer, size_t capacity, double value) {
    uint64_t encoding, mantissa; int exponent2, exponent10 = 0, negative, comparison, i, length = 9;
    cb_decimal_big numerator, denominator; char digits[9], result[32], exponent_digits[4]; size_t used = 0;
    memcpy(&encoding, &value, sizeof encoding); negative = (int)(encoding >> 63);
    exponent2 = (int)((encoding >> 52) & 2047);
    mantissa = encoding & UINT64_C(0xfffffffffffff);
    if (!exponent2 && !mantissa) {
        size_t length=negative?2:1;
        if(capacity<=length)cb_fail("number format buffer too small");
        strcpy(buffer,negative?"-0":"0");return length;
    }
    if (exponent2 == 2047) cb_fail("nonfinite number cannot be formatted");
    if (exponent2) { mantissa |= UINT64_C(1) << 52; exponent2 -= 1075; } else exponent2 = -1074;
    numerator = cb_decimal_new(36); denominator = cb_decimal_new(36);
    cb_decimal_set(&numerator, mantissa); cb_decimal_set(&denominator, 1);
    if (exponent2 >= 0) cb_decimal_left(&numerator, (size_t)exponent2);
    else cb_decimal_left(&denominator, (size_t)-exponent2);
    if (cb_decimal_compare(&numerator, &denominator) >= 0) {
        cb_decimal_small(&denominator, 10, 0);
        while (cb_decimal_compare(&numerator, &denominator) >= 0) {
            ++exponent10; cb_decimal_small(&denominator, 10, 0);
        }
        cb_decimal_small(&numerator, 10, 0);
    } else while (cb_decimal_compare(&numerator, &denominator) < 0) {
        --exponent10; cb_decimal_small(&numerator, 10, 0);
    }
    for (i = 0; i < 9; ++i) {
        digits[i] = '0';
        while (cb_decimal_compare(&numerator, &denominator) >= 0) {
            cb_decimal_subtract(&numerator, &denominator); ++digits[i];
        }
        if (i != 8) cb_decimal_small(&numerator, 10, 0);
    }
    cb_decimal_left(&numerator, 1); comparison = cb_decimal_compare(&numerator, &denominator);
    free(numerator.word); free(denominator.word);
    if (comparison > 0 || (comparison == 0 && ((digits[8] - '0') & 1))) {
        for (i = 8; i >= 0 && digits[i] == '9'; --i) digits[i] = '0';
        if (i >= 0) ++digits[i]; else { digits[0] = '1'; ++exponent10; }
    }
    while (length > 1 && digits[length - 1] == '0') --length;
    if (negative) result[used++] = '-';
    if (exponent10 >= -4 && exponent10 < 9) {
        if (exponent10 < 0) {
            result[used++] = '0'; result[used++] = '.';
            for (i = -1; i > exponent10; --i) result[used++] = '0';
            for (i = 0; i < length; ++i) result[used++] = digits[i];
        } else {
            for (i = 0; i <= exponent10; ++i) result[used++] = i < length ? digits[i] : '0';
            if (i < length) { result[used++] = '.'; for (; i < length; ++i) result[used++] = digits[i]; }
        }
    } else {
        int count = 0;
        result[used++] = digits[0];
        if (length > 1) { result[used++] = '.'; for (i = 1; i < length; ++i) result[used++] = digits[i]; }
        result[used++] = 'E';
        if (exponent10 < 0) { result[used++] = '-'; exponent10 = -exponent10; }
        do { exponent_digits[count++] = (char)('0' + exponent10 % 10); exponent10 /= 10; } while (exponent10);
        while (count) result[used++] = exponent_digits[--count];
    }
    if (used >= capacity) cb_fail("number format buffer too small");
    memcpy(buffer, result, used); buffer[used] = 0; return used;
}
#endif
static cb_value cb_number_value(long double number) {
    cb_value v; v.string=0; v.number=number; v.text=NULL;v.integer=0;v.whole=0;
    if (!isfinite(number)) cb_fail("numeric overflow or domain error");
#ifndef CB_REAL_BINARY64
    /* The extended BBC numeric representation shares positive real zero's
     * zero tag with integer zero. Binary64 keeps its explicit real tag. */
    if(number==0&&!signbit(number))v.integer=1;
#endif
    return v;
}
static cb_value cb_integer_value(int64_t number){cb_value v=cb_number_value((long double)number);v.integer=1;v.whole=number;return v;}
/* Original numeric-text conversion. BBC BASIC scales separately accumulated
 * whole and fractional digits through ascending binary powers of ten;
 * replacing that evaluation order with strtod changes observable results. */
static uint64_t cb_decimal_digits(const char **cursor,uint32_t *count,uint32_t *discarded) {
    uint64_t value=0;*count=0;*discarded=0;
    while(**cursor>='0'&&**cursor<='9') {
        unsigned int digit=(unsigned int)(*(*cursor)++-'0');++*count;
        if(*discarded||value>UINT64_MAX/10||
            (value==UINT64_MAX/10&&digit>UINT64_MAX%10))++*discarded;
        else value=value*10+digit;
    }
    return value;
}
static long double cb_decimal_scale(long double value,int64_t exponent) {
#ifdef CB_REAL_BINARY64
    static const long double powers[]={1E1L,1E2L,1E4L,1E8L,1E16L,1E32L,1E64L,1E128L,1E256L};
    const int64_t limit=512;
#else
    static const long double powers[]={1E1L,1E2L,1E4L,1E8L,1E16L,1E32L,1E64L,1E128L,1E256L,1E512L,1E1024L,1E2048L,1E4096L};
    const int64_t limit=8192;
#endif
    unsigned int bit=0;int divide=exponent<0;
    if(exponent>=limit)cb_fail("numeric overflow or domain error");
    if(exponent<=-limit)return 0;
    if(divide)exponent=-exponent;
    while(exponent) {
        if(exponent&1)value=divide?value/powers[bit]:value*powers[bit];
        exponent>>=1;++bit;
    }
    return value;
}
static cb_value cb_numeric_text(const char *text) {
    const char *cursor=text;uint32_t count,discarded;uint64_t whole,fraction;
    int negative=0,real;long double value;int64_t exponent;
    while(*cursor==' ')++cursor;
    if(*cursor=='-'||*cursor=='+')negative=*cursor++=='-';
    whole=cb_decimal_digits(&cursor,&count,&discarded);
    real=discarded||whole>(uint64_t)INT64_MAX||*cursor=='.';
    value=(long double)whole;
    if(discarded)value=cb_decimal_scale(value,discarded);
    if(*cursor=='.') {
        ++cursor;fraction=cb_decimal_digits(&cursor,&count,&discarded);
        value+=cb_decimal_scale((long double)fraction,(int64_t)discarded-count);
    }
    if(*cursor=='E') {
        int exponentNegative=0;uint32_t bits;
        real=1;++cursor;
        if(*cursor=='-'||*cursor=='+')exponentNegative=*cursor++=='-';
        fraction=cb_decimal_digits(&cursor,&count,&discarded);
        bits=(uint32_t)fraction;if(exponentNegative)bits=0u-bits;
        exponent=bits<=INT32_MAX?(int64_t)bits:(int64_t)bits-INT64_C(4294967296);
        value=cb_decimal_scale(value,exponent);
    }
    if(!real)return cb_integer_value(negative?-(int64_t)whole:(int64_t)whole);
    return cb_number_value(negative?0-value:value);
}
static cb_value cb_string_value(const unsigned char *bytes, size_t length) {
    cb_value v;
    if (length > SIZE_MAX - sizeof(cb_string) - 1) cb_fail("string too long");
    v.string=1; v.number=0; v.integer=0;v.whole=0;v.text=cb_allocate(sizeof(cb_string)+length+1);
    v.text->references=1; v.text->length=length;
    if (length) memcpy(v.text->data,bytes,length);
    v.text->data[length]=0;
    return v;
}
static cb_value cb_copy(cb_value value) {
    if(value.string && value.text) value.text->references++;
    return value;
}
static void cb_release(cb_value value) {
    if(value.string && value.text && --value.text->references==0) free(value.text);
}
static long double cb_number(cb_value value) {
    if(value.string) cb_fail("type mismatch: number required");
    return value.number;
}
static cb_string *cb_text(cb_value value) {
    if(!value.string) cb_fail("type mismatch: string required");
    return value.text;
}
static int32_t cb_int32(long double value) {
    long double r;
    if(!isfinite(value)) cb_fail("integer conversion overflow");
    r=fmodl(truncl(value),4294967296.0L);
    if(r<0)r+=4294967296.0L;
    if(r>=2147483648.0L)r-=4294967296.0L;
    return (int32_t)r;
}
static int64_t cb_int64(long double value) {
    long double r;
    if(!isfinite(value)) cb_fail("integer conversion overflow");
    r=truncl(value);
#ifdef CB_NATIVE_AARCH64
    /* The qualified native AArch64 BBCSDL build saturates real-to-integer
     * expression conversions. Spell that result explicitly, without using
     * an out-of-range C cast. The portable binary64 profile instead keeps
     * the WASM reference's checked conversion, including on Pico and Uno. */
    if(r >= 9223372036854775808.0L)return INT64_MAX;
    if(r < -9223372036854775808.0L)return INT64_MIN;
#else
    if(r < -9223372036854775808.0L || r >= 9223372036854775808.0L)
        cb_fail("number too big for integer conversion");
#endif
    return (int64_t)r;
}
static int64_t cb_as_int64(cb_value value){if(value.string)cb_fail("number required");return value.integer?value.whole:cb_int64(value.number);}
static int32_t cb_as_int32(cb_value value){uint32_t bits=(uint32_t)(uint64_t)cb_as_int64(value);return bits<=INT32_MAX?(int32_t)bits:(int32_t)((int64_t)bits-INT64_C(4294967296));}
#ifdef CB_NATIVE_ARMV7
static int64_t cb_armv7_assignment_integer(cb_value value) {
    long double real,magnitude;uint64_t bits;
    if(value.integer)return value.whole;
    real=truncl(cb_number(value));magnitude=real<0?-real:real;
    if(!isfinite(magnitude))cb_fail("integer conversion overflow");
    /* Match the native ARM EABI magnitude conversion without an undefined
     * out-of-range signed cast. Expression conversions still use cb_int64. */
    bits=magnitude>=18446744073709551616.0L?UINT64_MAX:(uint64_t)magnitude;
    if(real<0)bits=UINT64_C(0)-bits;
    return bits<=INT64_MAX?(int64_t)bits:-INT64_C(1)-(int64_t)(UINT64_MAX-bits);
}
#endif
static cb_value cb_zero(int kind) {
    return kind==2 ? cb_string_value((const unsigned char *)"",0) : cb_integer_value(0);
}
static cb_value cb_get(cb_var *variable) {
    if(!variable->defined)cb_fail("no such variable");
    return cb_copy(variable->value);
}
static void cb_set(cb_var *variable, cb_value value) {
    if((variable->kind==2)!=value.string)cb_fail("type mismatch in assignment");
    if(!value.string) {
        if(variable->kind==1) {
#ifdef CB_NATIVE_ARMV7
            int64_t integer=cb_armv7_assignment_integer(value);
#else
            int64_t integer=cb_as_int64(value);
#endif
            if(integer<INT32_MIN||integer>INT32_MAX)cb_fail("number too big for integer assignment");
            value=cb_integer_value(integer);
        }
        else if(variable->kind==4)value=cb_integer_value(cb_as_int64(value));
        else if(variable->kind==3) {
            double stored=(double)value.number;uint64_t encoding;
            memcpy(&encoding,&stored,sizeof encoding);
            /* BBC eight-byte storage reserves a zero high word for integer
             * zero. Tiny positive doubles canonicalize; negative zero and
             * negative subnormals retain their real representation. */
            value=(encoding>>32)==0?cb_integer_value(0):cb_number_value(stored);
        }
        /* Unsuffixed numeric storage retains exact integer expression values. */
    }
    if(variable->defined)cb_release(variable->value);
    variable->value=value;variable->defined=1;
}
static void cb_free_array(cb_array *array) {
    size_t i;
    for(i=0;i<array->count;i++)if(array->items[i].defined)cb_release(array->items[i].value);
    free(array->items);free(array->bounds);
    array->items=NULL;array->bounds=NULL;array->count=array->dimensions=0;
}
static void cb_dimension(cb_array *array,int kind,size_t dimensions,const long double *bounds) {
    size_t i,count=1;
    if(array->dimensions)cb_fail("array already dimensioned");
    if(!dimensions||dimensions>32)cb_fail("bad array dimensions");
    array->bounds=cb_allocate(dimensions*sizeof(size_t));
    for(i=0;i<dimensions;i++) {
        long double b=truncl(bounds[i]);size_t extent;
        if(b<0||b>2147483646.0L||b>(long double)(SIZE_MAX-1))cb_fail("bad array bound");
        extent=(size_t)b+1;
        if(extent>SIZE_MAX/count)cb_fail("array too large");
        array->bounds[i]=extent;count*=extent;
    }
    if(count>SIZE_MAX/sizeof(cb_var))cb_fail("array too large");
    array->items=cb_allocate(count*sizeof(cb_var));array->count=count;array->dimensions=dimensions;array->kind=kind;
    for(i=0;i<count;i++){array->items[i].kind=kind;array->items[i].defined=1;array->items[i].value=cb_zero(kind);}
}
static cb_var *cb_element(cb_array *array,size_t dimensions,const long double *indices) {
    size_t i,index=0;
    if(!array->dimensions)cb_fail("array not dimensioned");
    if(dimensions!=array->dimensions)cb_fail("wrong number of array subscripts");
    for(i=0;i<dimensions;i++) {
        long double n=truncl(indices[i]);
        if(n<0||n>=(long double)array->bounds[i])cb_fail("array subscript out of range");
        index=index*array->bounds[i]+(size_t)n;
    }
    return &array->items[index];
}
static void cb_local(cb_scope_record **scope,cb_var *variable) {
    cb_scope_record *record=cb_allocate(sizeof *record);
    record->array=0;record->address=variable;record->saved.scalar=*variable;record->next=*scope;*scope=record;
    variable->value=cb_zero(variable->kind);variable->defined=1;
}
static void cb_capture(cb_scope_record **scope,cb_var *variable){
    cb_scope_record *record=cb_allocate(sizeof *record);record->array=0;record->address=variable;record->saved.scalar=*variable;
    if(variable->defined)record->saved.scalar.value=cb_copy(variable->value);
    record->next=*scope;*scope=record;
}
static void cb_local_array(cb_scope_record **scope,cb_array *array) {
    cb_scope_record *record=cb_allocate(sizeof *record);
    record->array=1;record->address=array;record->saved.vector=*array;record->next=*scope;*scope=record;
    memset(array,0,sizeof *array);
}
static void cb_restore(cb_scope_record **scope) {
    while(*scope){cb_scope_record *r=*scope;*scope=r->next;
        if(r->array){cb_array *a=r->address;cb_free_array(a);*a=r->saved.vector;}
        else{cb_var *v=r->address;if(v->defined)cb_release(v->value);*v=r->saved.scalar;}
        free(r);
    }
}
static int cb_compare(cb_value a,cb_value b) {
    if(a.string!=b.string)cb_fail("type mismatch in comparison");
    if(a.string){size_t length=a.text->length<b.text->length?a.text->length:b.text->length;int n=memcmp(a.text->data,b.text->data,length);
        if(n)return n;return (a.text->length>b.text->length)-(a.text->length<b.text->length);}
    if(a.integer&&b.integer)return(a.whole>b.whole)-(a.whole<b.whole);
    return (a.number>b.number)-(a.number<b.number);
}
static int cb_equal(cb_value a,cb_value b){return cb_compare(a,b)==0;}
static int cb_truth(cb_value value){int yes=cb_number(value)!=0;cb_release(value);return yes;}
static cb_value cb_unary(const char *operation,cb_value value) {
    long double n=cb_number(value);
    if(!strcmp(operation,"NOT")){int64_t i=cb_as_int64(value);cb_release(value);return cb_integer_value(~i);}
    if(value.integer){int64_t i=value.whole;cb_release(value);if(!strcmp(operation,"+")||i==0)return cb_integer_value(i);if(i!=INT64_MIN)return cb_integer_value(-i);}
    else cb_release(value);
    if(!strcmp(operation,"-"))n=-n;
    return cb_number_value(n);
}
static int cb_integer_math(char op,int64_t a,int64_t b,int64_t *result) {
    if(op=='+'){if((b>0&&a>INT64_MAX-b)||(b<0&&a<INT64_MIN-b))return 0;*result=a+b;return 1;}
    if(op=='-'){if((b<0&&a>INT64_MAX+b)||(b>0&&a<INT64_MIN+b))return 0;*result=a-b;return 1;}
    if(op=='*'){
        if(!a||!b){*result=0;return 1;}
        if(a==-1){if(b==INT64_MIN)return 0;*result=-b;return 1;}
        if(b==-1){if(a==INT64_MIN)return 0;*result=-a;return 1;}
        if(a>0?(b>0?a>INT64_MAX/b:b<INT64_MIN/a):(b>0?a<INT64_MIN/b:a<INT64_MAX/b))return 0;
        *result=a*b;return 1;
    }
    return 0;
}
static cb_value cb_multiply(cb_value a,cb_value b) {
    long double x=cb_number(a),y=cb_number(b);int64_t integral;
    /* BBC multiplication returns a zero operand before floating promotion.
     * Binary64 negative zero has a nonzero payload; extended zero does not. */
#ifdef CB_REAL_BINARY64
    if(x==0&&!signbit(x)){cb_release(b);return a;}
    if(y==0&&!signbit(y)){cb_release(a);return b;}
#else
    if(x==0){cb_release(b);return a;}
    if(y==0){cb_release(a);return b;}
#endif
    if(a.integer&&b.integer&&cb_integer_math('*',a.whole,b.whole,&integral)) {
        cb_release(a);cb_release(b);return cb_integer_value(integral);
    }
    cb_release(a);cb_release(b);return cb_number_value(x*y);
}
#ifdef CB_NATIVE_ARMV7
/* ARM register shifts read the low byte of their count. These helpers make
 * the qualified native interpreter's negative-count behavior explicit. */
static uint32_t cb_arm_lsl(uint32_t value,uint32_t count){count&=255u;return count<32?value<<count:0;}
static uint32_t cb_arm_lsr(uint32_t value,uint32_t count){count&=255u;return count<32?value>>count:0;}
static uint32_t cb_arm_asr(uint32_t value,uint32_t count){
    count&=255u;
    if(!count)return value;
    if(count>=32)return value&UINT32_C(0x80000000)?UINT32_MAX:0;
    return(value>>count)|(value&UINT32_C(0x80000000)?UINT32_MAX<<(32-count):0);
}
#endif
static cb_value cb_binary(const char *operation,cb_value a,cb_value b) {
    cb_value result;long double x,y,n=0;int comparison;
    if(!strcmp(operation,"+")&&a.string&&b.string) {
        size_t length=a.text->length+b.text->length;
        if(length<a.text->length)cb_fail("string too long");
        result=cb_string_value((const unsigned char *)"",0);
        free(result.text);result.text=cb_allocate(sizeof(cb_string)+length+1);
        result.text->references=1;result.text->length=length;
        memcpy(result.text->data,a.text->data,a.text->length);memcpy(result.text->data+a.text->length,b.text->data,b.text->length);result.text->data[length]=0;
        cb_release(a);cb_release(b);return result;
    }
    if(!strcmp(operation,"=")||!strcmp(operation,"<>")||!strcmp(operation,"<")||!strcmp(operation,">")||!strcmp(operation,"<=")||!strcmp(operation,">=")) {
        comparison=cb_compare(a,b);
        if(!strcmp(operation,"="))n=comparison==0;
        if(!strcmp(operation,"<>"))n=comparison!=0;
        if(!strcmp(operation,"<"))n=comparison<0;
        if(!strcmp(operation,">"))n=comparison>0;
        if(!strcmp(operation,"<="))n=comparison<=0;
        if(!strcmp(operation,">="))n=comparison>=0;
        cb_release(a);cb_release(b);return cb_integer_value((int64_t)-n);
    }
    x=cb_number(a);y=cb_number(b);
    if(!strcmp(operation,"*"))return cb_multiply(a,b);
    if(a.integer&&b.integer&&strlen(operation)==1&&strchr("+-",operation[0])){int64_t integral;if(cb_integer_math(operation[0],a.whole,b.whole,&integral)){cb_release(a);cb_release(b);return cb_integer_value(integral);}}
    if(!strcmp(operation,"+"))n=x+y;
    else if(!strcmp(operation,"-"))n=x-y;
    else if(!strcmp(operation,"/")){if(y==0)cb_fail("division by zero");n=x/y;}
    else if(!strcmp(operation,"^")) {
        if(b.integer&&b.whole>=INT32_MIN&&b.whole<=INT32_MAX) {
            uint32_t exponent=(uint32_t)(b.whole<0?-b.whole:b.whole),bit=1;
            result=cb_integer_value(1);
            if(b.whole<0) {
                if(x==0)cb_fail("division by zero");
                cb_release(a);a=cb_number_value(1/x);
            }
            /* Scan exponent bits from most significant to least significant.
             * Each operation retains integer tags until actual overflow. */
            if(exponent) {
                while(bit<=exponent/2)bit<<=1;
                for(;bit;bit>>=1) {
                    result=cb_multiply(result,cb_copy(result));
                    if(exponent&bit)result=cb_multiply(result,cb_copy(a));
                }
            }
            cb_release(a);cb_release(b);return result;
        }
        n=powl(x,y);
    }
    else if(!strcmp(operation,"DIV")||!strcmp(operation,"MOD")) {
        int64_t ix=cb_as_int64(a),iy=cb_as_int64(b),answer;
        if(!iy)cb_fail("division by zero");
        if(ix==INT64_MIN&&iy==-1)answer=operation[0]=='D'?INT64_MIN:0;
        else answer=operation[0]=='D'?ix/iy:ix%iy;
        cb_release(a);cb_release(b);return cb_integer_value(answer);
    }
    else if(!strcmp(operation,"AND")||!strcmp(operation,"OR")||!strcmp(operation,"EOR")){int64_t ix=cb_as_int64(a),iy=cb_as_int64(b),answer=operation[0]=='A'?(ix&iy):operation[0]=='O'?(ix|iy):(ix^iy);cb_release(a);cb_release(b);return cb_integer_value(answer);}
    else if(!strcmp(operation,"<<")||!strcmp(operation,">>")||!strcmp(operation,">>>")) {
        int64_t ix=cb_as_int64(a),shift=cb_as_int64(b),answer;
        uint64_t bits=(uint64_t)ix;
        unsigned int amount=(unsigned int)((uint64_t)shift&63u);
#ifdef CB_NATIVE_ARMV7
        if(shift<0) {
            uint32_t count=(uint32_t)(uint64_t)shift,lo=(uint32_t)bits,hi=(uint32_t)(bits>>32);
            if(operation[0]=='<') {
                lo=cb_arm_lsl(lo,count);
                answer=lo<=INT32_MAX?(int64_t)lo:(int64_t)lo-INT64_C(4294967296);
            } else if(operation[2]=='>')answer=cb_arm_lsr(lo,count);
            else {
                lo=cb_arm_lsr(lo,count)|cb_arm_lsl(hi,32u-count);
                if(!((count-32u)&UINT32_C(0x80000000)))lo|=cb_arm_asr(hi,count-32u);
                hi=cb_arm_asr(hi,count);
                bits=((uint64_t)hi<<32)|lo;
                answer=bits<=INT64_MAX?(int64_t)bits:-INT64_C(1)-(int64_t)(UINT64_MAX-bits);
            }
            cb_release(a);cb_release(b);return cb_integer_value(answer);
        }
#endif
        if(operation[0]=='<') {
            uint32_t low=shift>63?0:(uint32_t)(bits<<amount);
            answer=low<=INT32_MAX?(int64_t)low:(int64_t)low-INT64_C(4294967296);
        } else {
            if(operation[2]=='>') {
                if(shift>63)bits=0;
                else {if(shift!=0)bits&=UINT32_MAX;bits>>=amount;}
            } else {
                if(shift>63)amount=63;
                if(amount){bits>>=amount;if(ix<0)bits|=UINT64_MAX<<(64-amount);}
            }
            answer=bits<=INT64_MAX?(int64_t)bits:-INT64_C(1)-(int64_t)(UINT64_MAX-bits);
        }
        cb_release(a);cb_release(b);return cb_integer_value(answer);
    }
    else cb_fail("unknown generated operator");
    cb_release(a);cb_release(b);return cb_number_value(n);
}
static void cb_put(unsigned char ch) {
    cb_platform_putchar(ch);
    if(ch==13)cb_column=0;else if(ch>=32)cb_column++;
}
static void cb_bytes(const unsigned char *bytes,size_t length){size_t i;for(i=0;i<length;i++)cb_put(bytes[i]);}
static void cb_newline(void){cb_put(13);cb_put(10);}
static void cb_spaces(unsigned int count){while(count--)cb_put(' ');}
static size_t cb_format(char *buffer,size_t capacity,long double value,int hex) {
    char *exponent,*source,*destination;
    if(hex) {
        value=truncl(value);
        if(value<INT32_MIN||value>INT32_MAX)cb_fail("number too big for hexadecimal conversion");
        uint32_t n=(uint32_t)cb_int32(value);char digits[8];size_t i=0;
        do{digits[i++]="0123456789ABCDEF"[n&15];n>>=4;}while(n);
        {size_t j;for(j=0;j<i;j++)buffer[j]=digits[i-1-j];buffer[i]=0;}return i;
    }
#ifdef CB_EXACT_DECIMAL_FORMAT
    cb_decimal_format(buffer,capacity,(double)value);
#elif defined(CB_REAL_BINARY64)
    snprintf(buffer,capacity,"%.9g",(double)value);
#else
    snprintf(buffer,capacity,"%.9Lg",value);
#endif
    exponent=strchr(buffer,'e');if(!exponent)exponent=strchr(buffer,'E');
    if(exponent){*exponent='E';source=exponent+1;destination=source;
        if(*source=='-')*destination++=*source++;else if(*source=='+')source++;
        while(*source=='0'&&source[1])source++;
        while((*destination++=*source++)){}
    }
    return strlen(buffer);
}
static void cb_print_begin(void){cb_print_width=10;}
static void cb_print_semicolon(void){cb_print_width=0;}
static void cb_print_comma(void){cb_spaces((10-cb_column%10)%10);cb_print_width=10;}
static void cb_print_newline(void){cb_newline();}
static void cb_print(cb_value value,int hex) {
    if(value.string){if(hex)cb_fail("hexadecimal PRINT requires a number");cb_bytes(value.text->data,value.text->length);}
    else{char buffer[96];size_t length=cb_format(buffer,sizeof buffer,value.number,hex);if(length<cb_print_width)cb_spaces(cb_print_width-(unsigned int)length);cb_bytes((unsigned char *)buffer,length);}
    cb_release(value);
}
/* BBC-compatible RND sequence, independently expressed as a 33-bit state
 * update. The sequence and seeding convention are part of language behavior;
 * the permitted BBCSDL evaluator was consulted as a semantic reference. */
static uint32_t cb_random_word;
static unsigned int cb_random_bit,cb_random_ready;
static uint32_t cb_random_next(void) {
    uint32_t old=cb_random_word;
    uint32_t shifted=(old>>1)|((uint32_t)cb_random_bit<<31);
    uint32_t mixed=shifted^(old<<12);
    cb_random_bit=old&1u;cb_random_word=mixed^(mixed>>20);
    return cb_random_word;
}
static cb_value cb_random(int count,cb_value argument) {
    int32_t parameter=count?cb_as_int32(argument):0;uint32_t bits;
    if(!cb_random_ready){cb_random_word=cb_platform_time_cs();cb_random_bit=cb_random_word==0;cb_random_ready=1;}
    if(count&&parameter<0){cb_random_word=(uint32_t)parameter;cb_random_bit=((uint32_t)parameter&0x80000u)==0;return cb_integer_value(parameter);}
    if(count&&(parameter==0||parameter==1)){if(parameter==1)cb_random_next();bits=(cb_random_word<<16)|(cb_random_word>>16);return cb_number_value((long double)bits/4294967296.0L);}
    bits=cb_random_next();
    return cb_integer_value(count?(int64_t)(bits%(uint32_t)parameter+1):
        bits<=INT32_MAX?(int64_t)bits:(int64_t)bits-INT64_C(4294967296));
}
static cb_value cb_builtin(const char *name,int count,cb_value a,cb_value b,cb_value c,int hex) {
    cb_value result=cb_integer_value(0);long double n=0;cb_string *s;size_t start,length,i;
    if(!strcmp(name,"RND"))result=cb_random(count,a);
    else if(!strcmp(name,"LEN"))result=cb_integer_value((int64_t)cb_text(a)->length);
    else if(!strcmp(name,"ASC")){s=cb_text(a);result=cb_integer_value(s->length?s->data[0]:-1);}
    else if(!strcmp(name,"CHR$")){unsigned char ch=(unsigned char)(uint32_t)cb_int32(cb_number(a));result=cb_string_value(&ch,1);}
    else if(!strcmp(name,"STR$")){char buffer[96];length=cb_format(buffer,sizeof buffer,cb_number(a),hex);result=cb_string_value((unsigned char *)buffer,length);}
    else if(!strcmp(name,"VAL"))result=cb_numeric_text((const char *)cb_text(a)->data);
    else if(!strcmp(name,"LEFT$")||!strcmp(name,"RIGHT$")||!strcmp(name,"MID$")) {
        s=cb_text(a);start=0;length=s->length;
        if(!strcmp(name,"MID$")) {
            long double position=cb_as_int32(b);start=position<=1?0:position>(long double)s->length?s->length:(size_t)position-1;
            length=s->length-start;if(count==3){n=cb_int32(cb_number(c));if(n>=0&&n<(long double)length)length=(size_t)n;}
        } else {
            n=count==1?(!strcmp(name,"LEFT$")?(long double)(s->length?s->length-1:0):1):cb_int32(cb_number(b));
            if(n>=0&&n<(long double)length)length=(size_t)n;if(!strcmp(name,"RIGHT$"))start=s->length-length;
        }
        result=cb_string_value(s->data+start,length);
    }
    else if(!strcmp(name,"STRING$")) {
        long double repeat=truncl(cb_number(a));s=cb_text(b);
        if(repeat<0||repeat>(long double)SIZE_MAX||(s->length&&repeat>(long double)(SIZE_MAX/s->length)))cb_fail("bad string repetition count");
        length=(size_t)repeat*s->length;
        result=cb_string_value((const unsigned char *)"",0);free(result.text);result.text=cb_allocate(sizeof(cb_string)+length+1);result.text->references=1;result.text->length=length;
        for(i=0;i<(size_t)repeat;i++)memcpy(result.text->data+i*s->length,s->data,s->length);result.text->data[length]=0;
    }
    else if(!strcmp(name,"INSTR")) {
        cb_string *needle=cb_text(b);s=cb_text(a);n=count==3?cb_as_int32(c):1;
        start=n<=1?0:n>(long double)s->length?s->length:(size_t)n-1;
        if(needle->length&&needle->length<=s->length&&n<=(long double)s->length){for(i=start;i<=s->length-needle->length;i++)if(!memcmp(s->data+i,needle->data,needle->length)){result=cb_integer_value((int64_t)i+1);break;}}
    }
    else {
        long double x=cb_number(a);
        if(!strcmp(name,"ABS"))n=fabsl(x);
        else if(!strcmp(name,"INT"))n=floorl(x);
        else if(!strcmp(name,"SGN"))n=(x>0)-(x<0);
        else if(!strcmp(name,"SQR"))n=sqrtl(x);
        else if(!strcmp(name,"SIN"))n=sinl(x);
        else if(!strcmp(name,"COS"))n=cosl(x);
        else if(!strcmp(name,"TAN"))n=tanl(x);
        else if(!strcmp(name,"ASN"))n=asinl(x);
        else if(!strcmp(name,"ACS"))n=acosl(x);
        else if(!strcmp(name,"ATN"))n=atanl(x);
        else if(!strcmp(name,"EXP"))n=expl(x);
        else if(!strcmp(name,"LN"))n=logl(x);
        else if(!strcmp(name,"LOG"))n=log10l(x);
        else if(!strcmp(name,"RAD"))n=x*(cb_pi/180);
        else if(!strcmp(name,"DEG"))n=x*(180/cb_pi);
        else cb_fail("unknown generated builtin");
        if(!strcmp(name,"SGN"))result=cb_integer_value((int64_t)n);
        else if(!strcmp(name,"ABS")&&a.integer&&a.whole!=INT64_MIN)
            result=cb_integer_value(a.whole<0?-a.whole:a.whole);
        else if(!strcmp(name,"INT")&&n>=-9223372036854775808.0L&&n<9223372036854775808.0L)
            result=cb_integer_value((int64_t)n);
        else result=cb_number_value(n);
    }
    cb_release(a);cb_release(b);cb_release(c);return result;
}
static void cb_for_validate(cb_value end,cb_value step){
    (void)cb_number(end);
    if(cb_number(step)==0) {
#ifdef CB_REAL_BINARY64
        /* The binary64 interpreter tests a real negative zero's sign bit as
         * nonzero at STEP entry; retain that profile-specific behavior. */
        if(!step.integer&&signbit(step.number))return;
#endif
        cb_fail("STEP cannot be zero");
    }
}
static int cb_for_next(cb_var *variable,cb_value end,cb_value step){
    cb_value next=cb_binary("+",cb_get(variable),cb_copy(step));
    int comparison=cb_compare(next,end);
    /* NEXT compares the original sum before typed storage truncates it. */
    cb_set(variable,next);
    return cb_number(step)<0?comparison>=0:comparison<=0;
}
static cb_value cb_time_get(void){return cb_integer_value(cb_int32((long double)(uint32_t)(cb_platform_time_cs()+cb_time_offset)));}
static void cb_time_set(cb_value value){cb_time_offset=(uint32_t)cb_int32(cb_number(value))-cb_platform_time_cs();cb_release(value);}
static int32_t cb_pin_argument(cb_value value){long double n=cb_number(value);int32_t i;if(n<0||n>INT32_MAX||n!=truncl(n))cb_fail("portable pin arguments must be nonnegative integers");i=(int32_t)n;cb_release(value);return i;}
static void cb_pin_mode(cb_value pin,cb_value mode){int32_t p=cb_pin_argument(pin),m;cb_string*s=cb_text(mode);if(s->length==5&&!memcmp(s->data,"input",5))m=0;else if(s->length==6&&!memcmp(s->data,"output",6))m=1;else if(s->length==12&&!memcmp(s->data,"input-pullup",12))m=2;else{cb_fail("invalid pin mode");m=0;}cb_release(mode);cb_platform_pin_mode(p,m);}
static void cb_pin_write(cb_value pin,cb_value value){int32_t p=cb_pin_argument(pin),v=cb_pin_argument(value);cb_platform_write(p,v);}
static void cb_pin_toggle(cb_value pin){cb_platform_toggle(cb_pin_argument(pin));}
static cb_value cb_pin_read(cb_value pin){return cb_integer_value(cb_platform_read(cb_pin_argument(pin)));}
static void cb_delay(cb_value duration){cb_platform_delay(cb_pin_argument(duration));}
static cb_value cb_millis(void){return cb_integer_value(cb_platform_millis());}
static unsigned char *cb_input_buffer;
static size_t cb_input_length,cb_input_position;
static int cb_input_line_mode,cb_input_question,cb_input_pending_lf;
static void cb_input_begin(cb_value prompt,int question,int line_mode){cb_string*s=cb_text(prompt);cb_bytes(s->data,s->length);cb_release(prompt);cb_input_question=question;cb_input_line_mode=line_mode;cb_input_length=cb_input_position=0;}
static void cb_input_read_line(void) {
    size_t capacity=32;int ch;free(cb_input_buffer);cb_input_buffer=cb_allocate(capacity);cb_input_length=cb_input_position=0;
    if(cb_input_question){cb_put('?');cb_put(' ');}
    for(;;){ch=cb_platform_getchar();if(cb_input_pending_lf){cb_input_pending_lf=0;if(ch==10)continue;}if(ch==EOF)cb_fail("end of input");if(ch==13||ch==10){cb_input_pending_lf=ch==13;break;}
        if(cb_input_length==255)cb_fail("input line too long");if(cb_input_length+1>=capacity){unsigned char*next;capacity*=2;next=realloc(cb_input_buffer,capacity);if(!next)cb_fail("out of memory");cb_input_buffer=next;}cb_input_buffer[cb_input_length++]=(unsigned char)ch;
    }
    cb_input_buffer[cb_input_length]=0;cb_newline();
}
static cb_value cb_input(int kind) {
    size_t start,length;cb_value value;
    if(cb_input_position>=cb_input_length)cb_input_read_line();
    start=cb_input_position;
    if(cb_input_line_mode){length=cb_input_length-start;cb_input_position=cb_input_length;}
    else {
        while(start<cb_input_length&&cb_input_buffer[start]==' ')start++;
        if(start<cb_input_length&&cb_input_buffer[start]=='"'){
            unsigned char *unquoted=cb_allocate(cb_input_length+1);length=0;cb_input_position=start+1;
            while(cb_input_position<cb_input_length){unsigned char ch=cb_input_buffer[cb_input_position++];if(ch=='"'){if(cb_input_position<cb_input_length&&cb_input_buffer[cb_input_position]=='"')cb_input_position++;else break;}unquoted[length++]=ch;}
            while(cb_input_position<cb_input_length&&cb_input_buffer[cb_input_position]!=',')cb_input_position++;if(cb_input_position<cb_input_length)cb_input_position++;
            value=cb_string_value(unquoted,length);free(unquoted);if(kind!=2)value=cb_builtin("VAL",1,value,cb_number_value(0),cb_number_value(0),0);return value;
        }
        else{cb_input_position=start;while(cb_input_position<cb_input_length&&cb_input_buffer[cb_input_position]!=',')cb_input_position++;length=cb_input_position-start;}
        if(cb_input_position<cb_input_length)cb_input_position++;
    }
    value=cb_string_value(cb_input_buffer+start,length);
    if(kind!=2)value=cb_builtin("VAL",1,value,cb_number_value(0),cb_number_value(0),0);
    return value;
}
static void cb_input_end(void){free(cb_input_buffer);cb_input_buffer=NULL;cb_input_length=cb_input_position=0;}
static void cb_basic_error(long double code,cb_value message){cb_string *s=cb_text(message);fprintf(stderr,"BASIC line %lu: error %ld: ",cb_line,(long)cb_int32(code));fwrite(s->data,1,s->length,stderr);fputc('\n',stderr);exit(1);}
`;
