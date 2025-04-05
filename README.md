
# Discord Bot Commands Documentation

Welcome to the official documentation for your Discord bot. Here you'll find a comprehensive list of commands, their usage, and descriptions.

> 💡 **Tip:** Prefix: `!` (e.g., `!ping`)

---

## 📜 Command List

| Command         | Description                                              | Usage Example                              | Permissions |
|-----------------|----------------------------------------------------------|--------------------------------------------|-------------|
| `!ping`         | Replies with "Pong!"                                     | `!ping`                                    | Everyone    |
| `!hello`        | Replies with a greeting                                  | `!hello`                                   | Everyone    |
| `!add`          | Adds two numbers                                         | `!add 5 10`                                | Everyone    |
| `!streamers`    | Lists all users with the 🎬 Streamer role                | `!streamers`                               | Everyone    |
| `!setbirthday`  | Sets birthday for a user                                 | `!setbirthday @User 29 03`                 | Mod Only    |
| `!birthday`     | Gets birthday of a user                                  | `!birthday @User`                          | Everyone    |
| `!settimezone`  | Sets timezone for a user                                 | `!settimezone @User UTC+6:30`              | Mod Only    |
| `!time`         | Gets the current time for a user based on their timezone | `!time @User`                              | Everyone    |

---

## 🛠️ Example Command Usage

### `!ping`

```bash
!ping
# ➜ pong
```

### `!hello`

```bash
!hello
# ➜ hello @Syn
```


### `!add`

```bash
!add 5 15
# ➜ The sum is 20
```

---

### `!setbirthday`

```bash
!setbirthday @Syn 29 3
# ➜ 🎉 Set birthday for Syn to 29 Mar
```

---

### `!settimezone`

```bash
!settimezone @Syn UTC+6:30
# ➜ 🌍 Set timezone for Syn to Asia/Kolkata
```

---

### `!time`

```bash
!time @Syn
# ➜ 🕒 Time for Syn: Sunday, April 6th 2025, 4:15 PM (UTC+6:30)
```
